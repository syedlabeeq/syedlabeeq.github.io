---
id: 2
slug: usb-storage-sierra-info-leak
title: Leaking Kernel Pointers Through a USB; KASLR Leak via sierra_ms.c
excerpt: A missing length check in the Sierra Wireless USB storage driver allowed a malicious device to return a short control transfer and leave stale kmalloc-64 bytes in a world-readable sysfs attribute. This post covers the bug, the KASLR bypass, slab grooming, and the fix now merged into maintained stable kernels.
date: 2026-10-08
readingTime: 16
tags: ["Security Research", "Linux Kernel", "Exploitation"]
---

Kernel Address Space Layout Randomization (KASLR) hides the kernel's code and data addresses, and it is one of the first barriers a privilege-escalation exploit has to clear. In practice, defeating it often comes down to finding one driver that exposes a kernel pointer to an unprivileged user.

This post covers one such case in `drivers/usb/storage/sierra_ms.c`, the Sierra Wireless TRU-Install mode-switching helper in the USB storage subsystem. An 18-year-old missing length check allowed a malicious USB device to return a short control transfer and make the kernel print uninitialized slab memory through a world-readable sysfs file. With basic slab grooming, those stale bytes become a pointer into kernel `.rodata`, which is enough to recover the kernel text base.

The bug was introduced in 2008, reported and patched in 2026, and the fix has been backported to maintained stable trees from 5.10 through 7.2. Everything below is reproducible in QEMU with a software-emulated malicious USB device; no physical hardware is required.

![End-to-end chain: short USB control transfer → stale kmalloc bytes → sysfs leak → KASLR bypass](/images/posts/usb-storage-sierra-info-leak/1-exploit-chain.png)

---

## The Bug

Sierra Wireless modems include a feature called TRU-Install. The device first appears as a small mass-storage "CD-ROM" containing drivers, and the host asks it — via a vendor-specific control request — whether it should switch into modem mode. The Linux-side logic lives in `drivers/usb/storage/sierra_ms.c`.

The query fills this fixed-size structure:

```c
struct swoc_info {
	__u8 rev;               /* byte 0        */
	__u8 reserved[8];       /* bytes 1-8     */
	__u16 LinuxSKU;         /* bytes 9-10    */
	__u16 LinuxVer;         /* bytes 11-12   */
	__u8 reserved2[47];     /* bytes 13-59   */
} __attribute__((__packed__));
```

The request is issued by `sierra_get_swoc_info()`:

```c
static int sierra_get_swoc_info(struct usb_device *udev,
				struct swoc_info *swocInfo)
{
	int result;

	result = usb_control_msg(udev, usb_rcvctrlpipe(udev, 0),
			SWIMS_USB_REQUEST_GetSwocInfo,	/* __u8 request      */
			USB_TYPE_VENDOR | USB_DIR_IN,	/* __u8 request type */
			0,				/* __u16 value       */
			0,				/* __u16 index       */
			(void *) swocInfo,		/* void *data        */
			sizeof(struct swoc_info),	/* __u16 size 	     */
			USB_CTRL_SET_TIMEOUT);		/* int timeout 	     */

	swocInfo->LinuxSKU = le16_to_cpu(swocInfo->LinuxSKU);
	swocInfo->LinuxVer = le16_to_cpu(swocInfo->LinuxVer);
	return result;
}
```

The driver requests exactly `sizeof(struct swoc_info)`, which is 60 bytes. `usb_control_msg()` returns the number of bytes actually transferred on success, or a negative errno on failure. The important detail: **a short IN transfer is not an error**. If the device returns 9 bytes, `usb_control_msg()` returns 9. The remaining 51 bytes in the caller's buffer are left untouched.

![usb_control_msg returns the actual transfer length; a short IN transfer is not automatically an error](/images/posts/usb-storage-sierra-info-leak/2-short-transfer-contract.png)

The callers only check for negative values:

```c
result = sierra_get_swoc_info(udev, swocInfo);
if (result < 0) {
	/* error path */
}
```

A return value of 9, 1, or even 0 is treated as success. The bug is simply that the returned length is never compared with the expected structure size. This pattern — request N bytes, then check only `< 0` — appears in several USB drivers and has been fixed elsewhere as a class of bugs.

### Where the Stale Bytes Surface

A missing length check only matters if the unwritten bytes become visible to an attacker. Here, they do.

When a device advertises a "full Linux package" via `containsFullLinuxPackage()`, `sierra_ms_init()` creates a sysfs attribute named `truinst` with mode **0444 — world-readable**:

```c
static DEVICE_ATTR_RO(truinst);
```

The show callback allocates a fresh, non-zeroed `kmalloc(60)` buffer on every read, queries the device again, and prints fields directly from that buffer:

```c
static ssize_t truinst_show(struct device *dev, struct device_attribute *attr,
			char *buf)
{
	struct swoc_info *swocInfo;
	/* ... */
	swocInfo = kmalloc(sizeof(struct swoc_info), GFP_KERNEL);
	/* ... */
	result = sierra_get_swoc_info(udev, swocInfo);
	if (result < 0) {
		kfree(swocInfo);
		return -EIO;
	}
	result = sysfs_emit(buf,
			    "REV=%02d SKU=%04X VER=%04X\n",
			    swocInfo->rev,
			    swocInfo->LinuxSKU,
			    swocInfo->LinuxVer);
	kfree(swocInfo);
	return result;
}
```

![Every cat truinst allocates a fresh non-zeroed kmalloc-64 object and prints selected fields](/images/posts/usb-storage-sierra-info-leak/4-sysfs-read-path.png)

So an unprivileged read of `cat /sys/bus/usb/devices/.../truinst` does this:

1. allocates 60 bytes from `kmalloc-64`,
2. asks the device for 60 bytes,
3. prints bytes 0 and 9–12 from the buffer.

If the device replies with only 9 bytes, `LinuxSKU` and `LinuxVer` come from memory the device never wrote. If it replies with a zero-length data stage, even `rev` is stale.

![With a 9-byte response, LinuxSKU and LinuxVer are read from stale kmalloc memory](/images/posts/usb-storage-sierra-info-leak/3-swoc-buffer-layout.png)

```
device sends 9 of 60 bytes:

offset   0    1 .... 8    9-10      11-12     13 ......... 59
       [rev][ reserved ][LinuxSKU][LinuxVer][   reserved2   ]
        ▲ device-written  ▲ STALE   ▲ STALE   ▲ STALE
        │                 │         │
        │                 └──── printed to unprivileged userspace
        └─────────────────────────────────────────────────────
        freshly allocated kmalloc-64 buffer (never zeroed)
```

---


## Why a Short Transfer Leaks Real Kernel Memory

The key question is what was in that buffer before the USB transfer. Two kernel behaviors make the answer useful:

- **`kmalloc()` does not zero memory by default.** Unless the kernel is built with `CONFIG_INIT_ON_ALLOC_DEFAULT_ON=y`, a new allocation contains data left by the previous user of that slab slot.
- **SLUB per-CPU freelists are LIFO.** The most recently freed object of a given size on the current CPU is usually the next object returned for that size.

`sizeof(struct swoc_info)` is 60 bytes, which goes into the busy **kmalloc-64** cache. That gives a useful primitive:

> Free a chosen 64-byte object on the local CPU, then read `truinst`. The driver's buffer can reuse that freed object, and the show callback prints bytes 9–12 of it.

![SLUB per-CPU freelists are LIFO: the recently freed donor object becomes the next kmalloc-64 allocation](/images/posts/usb-storage-sierra-info-leak/5-kmalloc64-lifo-grooming.png)

The device controls whether the leak happens by returning a short transfer. Slab grooming controls what stale object is reused. The result is a controlled disclosure of four bytes per read — limited, but enough.

One note on threat model: exploitation requires a malicious or emulated USB device. Kernel maintainers generally consider hostile physical USB devices outside the kernel security threat model, so this was handled publicly as a normal bug fix rather than under embargo, and no CVE is expected. Still, it is a real information leak and a useful example of how small driver bugs can break KASLR.

---

## From Five Stale Bytes to a KASLR Bypass

KASLR randomizes the kernel image by a 2 MiB-aligned slide at boot. Every symbol address is:

```
runtime_address = link_time_address + slide
```

To defeat KASLR, leaking any pointer to a fixed-offset kernel text or data location is enough:

```
slide = leaked_pointer - known_link_time_offset
```

The goal is to choose a freed 64-byte object that contains such a pointer at the bytes printed by `truinst`.

### Choosing the Donor Object

The donor object used here is `struct cgroup_namespace`, which is 48 bytes and allocated from `kmalloc-64` during `unshare(CLONE_NEWCGROUP)`. Its first member is `struct ns_common`, which places a `.rodata` pointer at a useful offset:

```c
struct cgroup_namespace {                 /* 48 bytes -> kmalloc-64 */
	struct ns_common ns;              /* offset 0 */
	/* ... */
};

struct ns_common {
	atomic_long_t stashed;                    /* offset 0 (8 bytes) */
	const struct proc_ns_operations *ops;     /* offset 8 */
	/* ... */
};
```

`ns.ops`, at offset 8, points to `cgroupns_operations` in kernel `.rodata`. The driver prints bytes 9–12 of the buffer, which correspond to bytes 1–4 of that pointer.

```
leaked pointer to cgroupns_operations (.rodata), little-endian:

byte:    0      1   2   3   4      5   6   7
       [0x80 ][ ?   ?   ?   ?  ][0xff ff ff]
         ▲      └──────┬──────┘     ▲
         │             │            └ always 0xff (kernel half of the address space)
         │             └ bytes 9-12 of the buffer: what truinst prints
         └ known: symbol's low byte (0x80), because the KASLR slide is 2 MiB-aligned
```

The read gives the middle four bytes. Byte 0 is known because the KASLR slide is 2 MiB-aligned, and bytes 5–7 are `0xff` for kernel addresses. That reconstructs the full pointer from one read:

```
kbase = leaked_ptr - (&cgroupns_operations - _text)
      = leaked_ptr - 0x1213180          (from `nm vmlinux` on the target build)
```

![Bytes 9–12 of the freed cgroup_namespace reveal the middle four bytes of a .rodata pointer](/images/posts/usb-storage-sierra-info-leak/6-pointer-reconstruction.png)

### Grooming the Slab

Reliability comes from making the driver's `kmalloc(60)` reuse a recently freed `cgroup_namespace`. The grooming is straightforward and unprivileged:

1. **Spray**: fork around 300 child processes. Each calls `unshare(CLONE_NEWCGROUP)` and then pauses, keeping its `cgroup_namespace` alive.
2. **Burst-free**: kill the children. Their objects are freed in a burst onto the per-CPU `kmalloc-64` freelist.
3. **Trigger**: read `truinst` immediately. The driver's allocation reuses a recently freed donor and prints bytes 9–12 of the stale `ops` pointer.

If a read does not match the expected kernel-pointer signature, repeat the batch. In practice, the signature check succeeds consistently.

---

## The Proof of Concept

No physical USB device is used. The malicious device is emulated with **raw_gadget** on top of **dummy_hcd**, a software USB Device Controller. Both the attacker gadget and the victim USB storage driver run inside the same kernel, while the host side sees what looks like a normal USB device. The demo runs in a QEMU/KVM VM booting a self-built Linux 6.12.108 LTS kernel.

![The PoC uses raw_gadget and dummy_hcd to emulate a malicious USB device entirely inside QEMU](/images/posts/usb-storage-sierra-info-leak/7-qemu-usb-emulation-topology.png)

### The Emulated Device

The gadget presents VID:PID `1199:0fff` for Sierra Wireless TRU-Install with a mass-storage interface. It implements just enough USB behavior to be probed, then uses two phases:

- **Enumeration**: answer GetSwocInfo with a full 60-byte `struct swoc_info` and `LinuxSKU = 0x2100`. The driver decides the device has a Linux package, stays in storage mode, and creates the world-readable `truinst` attribute.
- **Attack**: after that, answer each GetSwocInfo request with only **9 of 60 bytes**. The driver accepts the short response and prints stale heap data.

The VM `init` script runs the full chain automatically: enumeration, a first-stage `msg_msg` spray to show donor control, the `cgroup_namespace` KASLR bypass, and a comparison against `/proc/kallsyms`.

### Results

On the **vulnerable** kernel with KASLR enabled (full log: `poc/evidence/boot-vuln-recheck.log`):

```
[leak ] REV=00 SKU=0001 VER=0000        (x10 — stale tail bytes)
[kaslr] cgroup_ns-signature reads: 20/20
[kaslr] /proc/kallsyms _text : 0xffffffff9e200000  == LEAK MATCHES ==
```

All 20 recovered bases matched the true randomized base. Across reboots, the leaked value followed the KASLR slide (`0xffffffffb9400000`, `0xffffffff87e00000`, and so on). As a control, booting with `nokaslr` made the same code recover `0xffffffff81000000`, the link-time `_text`.

On the **patched** kernel, the same PoC fails cleanly (`poc/evidence/boot-fixverify3.log`):

```
~ # cat /sys/bus/usb/devices/*:*/truinst
[gadget] SWoC query #2: SHORT 9-of-60 bytes, rv=9 ...
cat: read error: Input/output error
```

The short transfer is rejected with `-EIO`, the sysfs read fails, and no stale kernel data is printed. Full-length responses still work, so legitimate devices are unaffected.

### Reproducing It

The `poc/` directory is self-contained. `build-kernel.sh` fetches and builds 6.12.108 with `USB_STORAGE`, `USB_RAW_GADGET`, and `USB_DUMMY_HCD` built in. `make-initramfs.sh` builds the PoC binaries into a busybox initramfs, and `boot.sh` starts the VM. Prebuilt vulnerable and fixed kernels (`bzImage.vuln`, `bzImage.fixed`) plus the initramfs are included for a quick boot-and-watch run.

One caveat: on kernels built with `CONFIG_INIT_ON_ALLOC_DEFAULT_ON=y`, the buffer is zeroed on allocation and the leak is neutralized. Boot with `init_on_alloc=0` to reproduce on those builds. The README also documents a few raw_gadget issues, including event-fetch truncation and endpoint descriptor size mismatches.

---

## Mitigation

![Before the fix, short transfers reached sysfs; after the fix, they fail with -EIO](/images/posts/usb-storage-sierra-info-leak/8-before-after-fix.png)

The fix is small: validate the transfer length and accept only a complete structure.

```diff
 		USB_CTRL_SET_TIMEOUT);		/* int timeout 	     */
 
+	/*
+	 * A short IN transfer leaves the tail of swocInfo uninitialized;
+	 * only a full transfer is valid.
+	 */
+	if (result != sizeof(struct swoc_info))
+		return -EIO;
+
 	swocInfo->LinuxSKU = le16_to_cpu(swocInfo->LinuxSKU);
```

Two details from the upstream discussion are worth noting.

First, why check the length instead of switching to `kzalloc()`? Zeroing the buffer would stop the leak, but it would also let the driver continue using fields the device never sent. Rejecting a short response makes the failure explicit, and `sierra_ms_init()` already retries failed queries.

Second, could this break real devices? The command requests a fixed-size structure, and the old driver already read fields at bytes 9–12 unconditionally. A device returning less than that was already causing the driver to make decisions based on garbage. The new check only turns that silent failure into a visible one.

### The Systemic Lesson

The patch fixes this driver, but the pattern is broader:

- **`usb_control_msg()` returns a length, not just success or failure.** Any caller that fills a fixed structure and checks only `< 0` can make the same mistake. New code should prefer `usb_control_msg_recv()`, which enforces the expected length and rejects short transfers with `-EREMOTEIO`.
- **`CONFIG_INIT_ON_ALLOC_DEFAULT_ON=y` blocks this bug class.** Zeroing allocations turns uninitialized heap disclosures into zeros. More distro kernels enable it now, and the performance cost is small compared with the number of bugs it eliminates.

### Disclosure and Merge Status

The bug was reported on the public linux-usb mailing list, following the maintainers' threat-model guidance. The patch, with `Fixes: 32fe5e393455` for the 2008 commit that introduced the issue, was accepted and backported to the **5.10, 5.15, 6.1, 6.6, 6.12, 6.18, and 7.2 stable trees**.

Systems running current point releases of those branches include the fix. The vulnerable window covers kernels built between 2008 and 2026 with `CONFIG_USB_STORAGE` enabled and allocation zeroing disabled.

---

## Where This Leaves Us

KASLR did not fail on its own; a length check failed in an old USB storage driver. The exploit chain is short: a short control transfer, a non-zeroing allocator, a world-readable sysfs file, and predictable slab reuse. None of those pieces is unusual, which is exactly why this class of bug keeps showing up in driver code.

For defenders, the action items are clear: enable `init_on_alloc`, use length-enforcing USB helpers, and audit code that checks only `< 0` after requesting a fixed-size transfer. For researchers, the PoC under `poc/` provides a hardware-free setup for testing malicious USB-device behavior against host drivers using raw_gadget and dummy_hcd.

---

## References

1. **sierra_ms.c (vulnerable source, v6.12.108)**. `drivers/usb/storage/sierra_ms.c`, Linux kernel source. <https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/tree/drivers/usb/storage/sierra_ms.c?h=v6.12.108>
2. **Bukhari, Syed Labeeq Sajid** "usb: storage: sierra_ms: reject short SWoC info transfers" (the fix patch). linux-usb mailing list. <https://lore.kernel.org/linux-usb/>
3. **Loy, D. (Sierra Wireless).** Commit `32fe5e393455` — "USB Storage Sierra: TRU-Install feature update" (2008, the `Fixes:` target). <https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?id=32fe5e393455>
4. **Kroah-Hartman, G.** "usb: misc: fix uninitialized-heap bugs" — the kzalloc()-based precedent for this bug class. <https://lore.kernel.org/r/20260819-usb_misc_random-v1-1-43a0dcee3a32@kroah.com>
5. **Andrey Konovalov / xairy.** "raw_gadget: a Linux kernel module for emulating USB devices." <https://github.com/xairy/raw-gadget>
6. **Linux kernel documentation.** "USB Raw Gadget" (USB gadget fuzzing interface). <https://www.kernel.org/doc/html/latest/usb/raw-gadget.html>
7. **Linux kernel documentation.** "init_on_alloc / init_on_free" (page and slab initialization hardening). <https://www.kernel.org/doc/html/latest/core-api/memory-allocation.html>
8. **Konovalov, A.** "Exploiting the Linux kernel via USB" — background on the malicious-USB-device attack surface and gadget-based fuzzing. <https://github.com/xairy/raw-gadget>
9. **Linux kernel source.** `usb_control_msg_recv()` — the length-enforcing control transfer helper, `drivers/usb/core/message.c`. <https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/tree/drivers/usb/core/message.c>
10. **PaX / grsecurity.** "KASLR: An Exercise in Cargo Cult Security" and related design notes on kernel ASLR. <https://pax.grsecurity.net/>
