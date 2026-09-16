---
id: 5
slug: cheri-part-1
title: CHERI — Part 1
excerpt: CHERI replaces forgeable integer pointers with unforgeable hardware capabilities that carry bounds, permissions, and a validity tag. This primer covers the memory-safety threat model, the capability model's three invariants, and how tagged memory works.
date: 2026-09-07
readingTime: 14
tags: ["Security Research", "Computer Architecture", "Memory Safety"]
---

Modern mitigations protect different stages of exploitation while leaving the conventional pointer representation unchanged. DEP and W^X restrict code execution, ASLR makes useful addresses harder to predict, stack canaries detect selected stack overwrites, and Intel CET protects selected control-flow transfers. These defenses are valuable, but they do not attach bounds or authority to ordinary pointers. CHERI addresses that different layer of the problem: what if the pointer itself carried hardware-enforced authority and could not be forged from arbitrary bytes? This first part covers the memory-safety threat model, introduces the capability as a hardware primitive, and explains the tagged-memory mechanism behind it.

---

## Why Another Approach to Memory Safety?

Conventional C and C++ implementations usually represent pointers as integer-sized machine addresses. You can copy, cast, and perform arithmetic on them, but the representation carries little or no per-pointer hardware metadata describing what memory it is *allowed* to reach. That is a major reason pointer errors can become unrestricted memory accesses, although the bugs themselves also arise from language semantics, allocator behavior, concurrency, and software design.

The industry's response has been a long series of **mitigations** layered on top of the unsafe model:

- **DEP / NX** prevents execution from pages marked non-executable; **W⊕X** policies avoid mappings that are writable and executable at the same time.
- **ASLR** randomizes where things live so useful addresses are harder to predict.
- **Stack canaries** detect sequential stack overwrites before a function returns.
- **Intel CET** supplies hardware control-flow protections: shadow stacks protect returns, while indirect branch tracking restricts indirect jumps and calls to marked landing points.

Each of these is valuable, and each is *narrow*. They constrain selected **consequences** of memory corruption without adding bounds and provenance to ordinary pointers. The "SoK: Eternal War in Memory" survey documents the continuing arms race between memory-corruption exploitation and defenses [4]. CHERI's designers attack a more fundamental layer by protecting pointers themselves.

**CHERI** (Capability Hardware Enhanced RISC Instructions) takes a different route. In pure-capability software, it represents pointers with a hardware primitive called a **capability**. A capability carries its own bounds and permissions and cannot be fabricated from arbitrary data [1]. Hybrid systems can retain conventional integer pointers for compatibility. CHERI is a change to the instruction set and software stack, not just another mitigation around the old model.

> Intel CET protects control flow after memory corruption: its shadow stack checks return addresses, while Indirect Branch Tracking restricts indirect jumps and calls to marked entry points. CHERI addresses a broader but different question: *"does a capability authorize this memory access?"* Every data access and instruction fetch is authorized by a capability: normally the named pointer capability in pure-capability code, DDC for legacy accesses where supported, and PCC for instruction fetch.

CHERI is a broad hardware/software co-design effort spanning processors, compilers, operating systems, runtimes, and applications. It has real silicon behind it in Arm's Morello research prototype, while RISC-V International is developing the pre-ratification RVY CHERI extensions.

This series stays focused on CHERI, but the contrast with CET will return. A later series will follow the narrower control-flow path in detail: how Intel shadow stacks protect returns, how Indirect Branch Tracking constrains indirect branches, and why valid control-flow targets can still leave room for exploitation.

---

## The Threat Model

First, name what CHERI is trying to prevent. Memory-safety violations fall into three families:

- **Spatial safety violations** access memory outside the intended object's bounds. Classic buffer overflows and out-of-bounds reads and writes live here.
- **Temporal safety violations** access memory outside the intended object's *lifetime*. Use-after-free and use-after-return are canonical examples. Invalid lifetime-management operations such as double-free are closely related and can lead to allocator corruption or later temporal violations.
- **Referential or provenance violations** use pointer authority that was never legitimately derived or has been corrupted. Forging a pointer from an integer and corrupting a stored pointer are examples. Type confusion is related but distinct: it can occur through a valid capability and generally needs additional language, runtime, or sealing-based enforcement.

Assume a bug gives an adversary control over data or execution within a protection domain. CHERI aims to ensure that the attacker cannot forge new authority or exceed the bounds and permissions of capabilities reachable to that domain. Existing valid capabilities can still be misused, so distributing minimal authority remains important.

On a conventional CPU, a corrupted pointer-sized value may be consumed as an address without per-pointer provenance or bounds checks. Depending on the affected object and other mitigations, that can enable disclosure, data corruption, or control-flow hijacking.

If an attacker overwrites a capability using ordinary byte or integer stores, the result is untagged and cannot authorize a memory access. The attacker may still substitute or reuse a valid capability already available to the compromised code, but cannot manufacture authority beyond that reachable set. CHERI deterministically enforces capability validity, encoded bounds, and permissions; a pure-capability software stack uses those mechanisms to provide strong allocation-level spatial and referential protection [5]. Temporal safety requires an additional policy such as revocation, garbage collection, or non-reuse; Part 3 focuses on revocation.

![CHERI threat model: spatial, temporal, and referential safety](/images/posts/cheri-part-1/1-1.jpeg)



---

## Anatomy of a Capability

In current compressed 64-bit CHERI designs, including Morello and RV64Y, a capability occupies **128 addressable bits**, twice the size of a conventional pointer, plus a **1-bit tag** outside the addressable value. Other CHERI variants use different widths. The 128 bits hold:

- **Address**: the current pointer value. A memory operation can use it only when the capability also passes tag, type, bounds, permission, and virtual-memory checks.
- **Bounds**: a base and exclusive top defining the byte range the capability may authorize. Current compressed encodings draw on CHERI Concentrate; exact formats are ISA-specific [3].
- **Permissions**: a bitmask covering load, store, execute, load-capability, store-capability, seal, and more.
- **Capability or object type**: architecture-specific metadata used for *sealing*, one mechanism behind software compartmentalization (covered later in the series).

The idea of an unforgeable token of authority is not new. It has roots in Dennis and Van Horn's 1966 work on programming semantics for multiprogrammed computations [7], and Levy's *Capability-Based Computer Systems* catalogues a whole generation of capability machines [8]. CHERI's contribution is adapting capabilities to conventional RISC pipelines and existing C/C++ ecosystems with high source compatibility and experimentally modest overheads, while accepting ABI, toolchain, and memory-system changes.

### The Three Invariants

What makes a capability trustworthy is not the fields it contains. It is the **invariants the hardware enforces** on it. There are three, and they work together [2]:

1. **Provenance**: every valid capability must be derived from valid authority through a legal operation. At reset or entry into an execution environment, software receives an initial set of capabilities. Everything else descends from authority already available to the system. You cannot conjure a valid capability from an arbitrary integer alone.

2. **Integrity**: ordinary software data writes cannot forge or alter an in-memory capability into another usable capability. If such a write overlaps its representation, the tag is cleared. The tag is an architectural integrity mechanism, not a general error-detecting code for every possible hardware fault.

3. **Monotonicity**: ordinary derivation can produce only **narrower or equal** authority. You can shrink bounds and drop permissions; you cannot grow bounds or add permissions. Carefully controlled operations such as protection-domain entry and exception delivery can transfer control to trusted code with different authority.

Together the three close the loop. Provenance says every capability has a legitimate ancestor. Monotonicity says no descendant gains authority. Integrity says you cannot cheat by editing the bits in memory.

![Capability layout and the three invariants](/images/posts/cheri-part-1/1-2.jpeg)


### A Concrete Example: Accounts, Branches, and Ledgers

The easiest way to see the invariants in action is to walk through one small story and slow down at each step. Imagine a banking backend where every account belongs to a branch, and every branch relies on a central ledger to authorize transfers:

```c
struct Ledger {
    bool (*authorize_transfer)(const char *account_id, unsigned amount);
};

struct Branch {
    struct Ledger *ledger;   // trusted authority for transfers
    struct Branch *parent;
};

struct DebitCard {
    char PAN[19];             // Primary Account Number
};

struct Account {
    char            account_id[16];
    struct Branch  *branch;        // which branch manages this account
    struct DebitCard *card;
};
```

#### Step 1: What the plain C pointers mean

Think of the live objects like this:

```
Account
  ├─ account_id
  ├─ branch ──> Branch
  │               ├─ ledger ──> Ledger
  │               └─ parent ...
  └─ card   ──> DebitCard
```

Programmers expect the account to reach the ledger **through** its branch. On conventional hardware a pointer is just an address, so `account.branch` might literally contain `0x1000`, the location of the branch object.

#### Step 2: The bug on a conventional CPU

Suppose an overflow in `card->PAN` lets an attacker scribble past the end of the card and into neighbouring fields. They aim to replace the branch pointer with the ledger’s address:

```
Before overflow: account.branch = 0x1000  (Branch)
After overflow:  account.branch = 0x5000  (Ledger)
```

When the application later runs `account->branch->ledger`, it unknowingly treats the ledger pointer as if it belonged to a branch. That is a classic confused-authority exploit enabled by forgeable pointers.

#### Step 3: What CHERI changes

CHERI keeps the exact same C source but changes what those pointers are at runtime. Each pointer becomes a capability: a protected bundle of **address + bounds + permissions + valid tag**. Here is the rough capability state when the program is healthy:

| Field                | Authority carried by the capability                                          |
|----------------------|-------------------------------------------------------------------------------|
| `account.branch`     | base = branch object, bounds = `sizeof(struct Branch)`, permissions = read    |
| `branch.ledger`      | base = ledger object, bounds = `sizeof(struct Ledger)`, permissions = call    |
| `account.card`       | base = debit card, bounds = `sizeof(struct DebitCard)`, permissions = read/write |

Each entry represents a different “token of authority.” Knowing that the ledger resides at `0x5000` is not the same as holding the ledger capability with its tag set.

#### Step 4: Replay the overflow under CHERI

The same overflow now writes attacker-controlled bytes over `account.branch`. The hardware notices that an ordinary byte store touched a capability slot and **clears its tag**. The slot still contains the attacker’s bytes, but the bundle now looks like “address = 0x5000, permissions = garbage, tag = 0.” The moment the code executes `account->branch->ledger`, the CPU sees an *untagged* capability and raises a fault. The forged pointer dies before it can reach the ledger.

#### Step 5: Why the attacker cannot just rebuild the capability

Could the attacker craft the exact bit pattern of a valid capability? Provenance says no. A capability with tag = 1 must descend from an earlier valid capability through a legal derivation. Arbitrary data cannot gain a tag, and derivation instructions can only **shrink** authority (monotonicity). Even if the attacker holds another branch capability, the best they can do is derive *less* authority from it, never a wider ledger capability.

So the three invariants play out in order:

- **Provenance** keeps capabilities tied to legitimate ancestors.
- **Integrity** clears the tag when the overflow writes raw bytes.
- **Monotonicity** ensures any copied capability can only lose authority.

The program still has a bug—the overflow happened—but CHERI prevents that bug from turning into a forged, more-powerful pointer.

![Capabilities protecting accounts, branches, and ledgers](/images/posts/cheri-part-1/1-4.jpeg)


### Guarded Manipulation

The way hardware reacts to an invalid manipulation is worth spelling out because it is easy to overgeneralize. In current CHERI designs, many non-monotonic or unrepresentable capability transformations produce a result **with its tag cleared** rather than immediately trapping. Exact behavior is instruction- and architecture-specific. Arbitrary data alone cannot become a tagged capability, although controlled reconstruction operations may authorize a candidate value using an existing capability with sufficient authority.

The output remains inspectable data, but it is no longer a *valid* capability and cannot authorize a protected operation. A later attempt to dereference it raises an exception. This "clear the tag rather than fault immediately" behavior is called guarded manipulation. It defers failure until an authorizing use and avoids immediate data-dependent exceptions in many capability-manipulation instructions.

---

## Tagged Memory: Where the Guarantee Lives

The invariants above depend on one physical mechanism: the **validity tag**. It is also the reason clever memory writes cannot bypass CHERI.

### The Tag Is Out of Band

Every capability carries a 1-bit tag that marks its representation as a valid capability. Successful use still requires suitable bounds, permissions, type, and other architectural checks. The tag is **not part of the 128-bit addressable value** and cannot be directly written as ordinary data. Hardware propagates it on capability loads and stores, and capability-specific instructions can inspect its state [2].

Tags are tracked at capability granularity: in a 128-bit design, one tag bit corresponds to each naturally aligned 16-byte capability slot. A capability store to aligned, tag-capable memory preserves its tag, and a matching capability load restores it. Ordinary data stores, unsuitable alignment, or memory that cannot carry tags do not preserve a valid in-memory capability.

### Tag and Data Move Atomically

Architecturally, the tag is bound **atomically** to the capability data. Software cannot write chosen bytes and then set the tag independently. Implementations may store and transport tags in different ways, but a tagged result can arise only through an architecturally permitted operation backed by sufficient existing capability authority.

### Any Ordinary Write Clears the Tag

The rule that ties this together is simple:

> A non-capability store that writes any byte of a tagged capability-sized slot **clears that slot's tag**.

Suppose an attacker overflows a buffer and writes attacker-controlled bytes over a stored capability. Those bytes land as ordinary data, the tag drops, and the representation can no longer authorize access. The next dereference faults. This prevents arbitrary-byte pointer forgery; it does not prevent compromised code from copying or misusing another valid capability it can already reach.

### The Cost of Tag Storage

Tagged memory is not free. Tags require protected storage and propagation through the memory hierarchy. One practical design reserves part of DRAM as a **tag table** and adds a **tag cache** near the memory controller; other systems can use widened or ECC-backed memory. Overhead depends on the implementation, tag density and locality, cache organization, and workload.

There is also a coverage constraint: **not all memory must be tag-capable**. Platform memory attributes define which physical regions can carry tags. MMIO and DMA behavior is platform-specific, so OS and driver authors must know which regions and devices can legitimately preserve capabilities.

![Tagged memory: tag table, tag cache, and tag-clearing on data writes](/images/posts/cheri-part-1/1-3.jpeg)


---

## Where This Leaves Us

CHERI strengthens the pointer primitive itself. In pure-capability software, pointers become hardware-enforced capabilities governed by provenance, integrity, and ordinary-derivation monotonicity. Tagged memory prevents software from forging a valid capability through ordinary data writes. Hardware then deterministically enforces the capability's encoded bounds and permissions; compiler, allocator, runtime, and OS policies determine how closely those bounds match source-language objects.

Two questions remain, and they set up the rest of the series:

- **How do you fit meaningful bounds and permissions into just 128 bits without wrecking performance?** **Part 2** covers CHERI Concentrate and its "representable region," plus the separate choices around merged registers, PCC, DDC, and sealing.
- **What about temporal safety and isolation?** Capabilities alone do not invalidate every retained alias when an object's lifetime ends. **Part 3** covers revocation (CHERIvoke, Cornucopia), compartmentalization, and the real-world ecosystem: Morello, CHERI-RISC-V, and the C/C++ gotchas you hit in practice.

After those questions, one comparison will remain: what can a focused control-flow defense achieve without changing the pointer model? That is where the later Intel CET series will begin.

CHERI is not a silver bullet. It strengthens the pointer primitive rather than relying only on exploit mitigations, while still requiring sound compiler, runtime, OS, and authority-management policies.

---

## References

1. **Watson, R. N. M., Woodruff, J., Neumann, P. G., Moore, S. W., Anderson, J., Chisnall, D., Dave, N., Davis, B., Gudka, K., Laurie, B., Murdoch, S. J., Norton, R., Roe, M., Son, S., and Vadera, M.** "CHERI: A Hybrid Capability-System Architecture for Scalable Software Compartmentalization." *IEEE Symposium on Security and Privacy (S&P)*, 2015, pp. 20–37. <https://doi.org/10.1109/SP.2015.9>
2. **Watson, R. N. M., Neumann, P. G., Woodruff, J., Roe, M., Almatary, H., Anderson, J., Baldwin, J., Barnes, G., Chisnall, D., Clarke, J., Davis, B., Eisen, L., Filardo, N. W., Fuchs, F. A., Grisenthwaite, R., Joannou, A., Laurie, B., Markettos, A. T., Moore, S. W., Murdoch, S. J., Nienhuis, K., Norton, R., Richardson, A., Rugg, P., Sewell, P., Son, S., and Xia, H.** "Capability Hardware Enhanced RISC Instructions: CHERI Instruction-Set Architecture (Version 9)." Technical Report UCAM-CL-TR-987, University of Cambridge Computer Laboratory, September 2023. <https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-987.pdf>
3. **Woodruff, J., Joannou, A., Xia, H., Fox, A., Norton, R. M., Chisnall, D., Davis, B., Gudka, K., Filardo, N. W., Markettos, A. T., Roe, M., Neumann, P. G., Watson, R. N. M., and Moore, S. W.** "CHERI Concentrate: Practical Compressed Capabilities." *IEEE Transactions on Computers*, Vol. 68, No. 10, 2019, pp. 1455–1469. <https://doi.org/10.1109/TC.2019.2914037>
4. **Szekeres, L., Payer, M., Wei, T., and Song, D.** "SoK: Eternal War in Memory." *IEEE Symposium on Security and Privacy (S&P)*, 2013, pp. 48–62. <https://doi.org/10.1109/SP.2013.13>
5. **Davis, B., Watson, R. N. M., Richardson, A., Neumann, P. G., Moore, S. W., Baldwin, J., Chisnall, D., Clarke, J., Filardo, N. W., Gudka, K., Joannou, A., Laurie, B., Markettos, A. T., Maste, J. E., Mazzinghi, A., Napierala, E. T., Norton, R. M., Roe, M., Sewell, P., Son, S., and Woodruff, J.** "CheriABI: Enforcing Valid Pointer Provenance and Minimizing Pointer Privilege in the POSIX C Run-time Environment." *ASPLOS*, 2019, pp. 379–393. <https://doi.org/10.1145/3297858.3304042>
6. **Watson, R. N. M., Moore, S. W., Sewell, P., and Neumann, P. G.** "An Introduction to CHERI." Technical Report UCAM-CL-TR-941, University of Cambridge Computer Laboratory, September 2019. <https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-941.pdf>
7. **Dennis, J. B., and Van Horn, E. C.** "Programming Semantics for Multiprogrammed Computations." *Communications of the ACM*, Vol. 9, No. 3, 1966, pp. 143–155. <https://doi.org/10.1145/365230.365252>
8. **Levy, H. M.** *Capability-Based Computer Systems*. Digital Press, 1984. <https://homes.cs.washington.edu/~levy/capabook/>
9. **RISC-V CHERI Task Group.** "RISC-V Specification for CHERI Extensions." RISC-V International (draft). <https://riscv.github.io/riscv-cheri/>
10. **University of Cambridge / SRI International.** "Capability Hardware Enhanced RISC Instructions (CHERI)." Project homepage. <https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/>
