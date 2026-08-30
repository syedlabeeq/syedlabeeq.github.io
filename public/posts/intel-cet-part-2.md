# 2. Overview of Intel Control-Flow Enforcement Technology (CET)

Before we get into the two mechanisms CET introduces, it is worth stepping back for a moment to think about why Intel built this in hardware at all. We already had software CFI. Compilers had been adding control-flow checks for years. So what was the actual problem?

The short answer is that software checks are just code, and code can be attacked. CET moves the enforcement somewhere attackers cannot reach.

![Intel CET high-level overview](Images/intro.jpeg "Diagram of CPU highlighting Shadow Stack and IBT")

---

## 2.1 What Intel Was Trying to Build

When Intel published the CET specification, they laid out a few properties the feature had to have. Looking at them together, you can see the engineering constraints they were working under.

### The Check Has to Live Outside Attacker Reach

Tools like Clang CFI, Microsoft CFG, and GCC's `-fcf-protection` work by inserting checks directly into the compiled binary. Before an indirect branch, the compiler adds a few instructions that validate the target. That sounds reasonable until you realize those instructions live in the same address space, run on the same CPU, and have the same privileges as the code being exploited.

An attacker with a write primitive can overwrite the check itself. Or corrupt the metadata the check reads. Or, in some cases, simply jump over it. The protection is real, but it is sitting in territory the attacker can already touch.

CET sidesteps this by moving enforcement into the CPU's execution logic. There is no check instruction to overwrite. The comparison between a return address and the shadow stack happens inside the hardware, not as something you can find in a disassembler. That is the fundamental shift.

![Shadow stack and IBT inside processor pipeline](Images/2-1-A.jpeg "Hardware enforcement inside CPU")

### It Has to Be Fast Enough That People Actually Use It

Performance is where most software CFI proposals die. Fine-grained software CFI typically costs somewhere between 5 and 15 percent in runtime overhead. For most production workloads, that is a non-starter. Nobody is shipping a 10 percent regression to protect against a class of attack that may or may not be exploited in the wild.

Intel designed CET to be cheap by construction:

* The shadow stack push and pop are tied into the CPU's call/return prediction logic. On the fast path, they run alongside normal stack operations and add almost nothing.
* IBT's `endbr` instruction, at entry points, does not add a branch or a conditional. The CPU just checks the opcode at the target address. On older hardware without CET, the instruction is a NOP.
* Per-thread memory cost is a few pages for the shadow stack plus four bytes per guarded function entry.

Intel's own benchmarks put the overhead below one percent for most workloads. Some call-heavy microbenchmarks push up to around three percent. Those numbers are good enough that OS vendors and compilers actually enabled it, which is the real test.

![Bar chart comparing software CFI and Intel CET overhead](Images/2-1-B.jpeg "Runtime overhead: Software CFI vs Intel CET")

### It Cannot Break Existing Software

This one is tricky. Intel ships into a world with billions of existing binaries. Any feature that breaks old code will be disabled by default and never used.

The solution was a clean NOP encoding. On a CPU that does not support CET, `endbr64` and `endbr32` execute as no-ops. A binary compiled with CET support runs correctly everywhere. Compilers could start emitting the instruction before CET hardware was widely available.

Beyond that, the OS controls which processes get CET enforcement. A legacy binary that has never been recompiled can still run. It just does not get the protection. Separate configuration bits exist for user mode and kernel mode, so each can be tuned independently.

![Split view of CET NOP on old CPUs vs active enforcement](Images/2-1-C.jpeg "Backward compatibility across CPU generations")

### It Is One Layer, Not the Whole Defense

CET was never meant to replace DEP or ASLR. The design assumes those are already in place. DEP prevents injecting and running new code. ASLR makes it hard to predict where anything lives. CET addresses what happens after both of those are bypassed: the attacker has leaked an address and corrupted memory, and is now trying to reuse existing code. Each layer handles a different part of the attack, and the combination is stronger than any single piece.

![Stacked shields labeled DEP, ASLR, CET](Images/2-1-D.jpeg "Layered defense with CET complementing DEP and ASLR")

---

## 2.2 Two Edges, Two Mechanisms

Control-flow hijacking attacks have to abuse one of two places: a return instruction or an indirect branch. CET adds a separate guard for each.

### Returns: The Backward Edge

Every function call saves a return address on the stack so the CPU knows where to jump back when the function is done. The stack is writable. That has always been true. Stack buffer overflows have been corrupting return addresses since the mid-1990s, and despite three decades of mitigations, it is still a viable attack path in practice.

```
Normal execution:

  main() --> call --> foo() --> call --> bar()
  main() <-- ret --- foo() <-- ret ---- bar()

Hijacked backward edge:

  main() --> call --> foo() --> call --> bar()
                               ret to attacker's gadget chain
                               (return address was overwritten)
```

The shadow stack fixes this by keeping a second copy of every return address in a region that normal instructions cannot write to. On `call`, the CPU pushes to both the regular stack and the shadow stack. On `ret`, it compares the two. If they disagree, the CPU raises a control protection fault and the process stops. The attacker can corrupt the normal stack all they like; the shadow stack is not reachable that way.

![Normal and hijacked return flow comparison](Images/2-2-A.jpeg "Backward edge attacks vs shadow stack protection")

### Indirect Branches: The Forward Edge

Not all control transfers go through `ret`. Indirect calls and jumps compute their target at runtime. Think of `call [rax]`, calls through function pointers, or virtual method dispatch in C++. The target address sits in a register or memory slot, and whoever controls that slot controls where execution goes next.

```
Normal execution:

  call [rax]  -->  target_function()    (rax holds a valid address)

Hijacked forward edge:

  call [rax]  -->  gadget somewhere in memory   (rax was corrupted)
```

IBT handles this with a simple state machine. After any indirect call or jump, the CPU goes into a wait state. The very next instruction executed must be `endbr64` (or `endbr32` in 32-bit mode). If it is not, the CPU faults. Since compilers only place `endbr` at the start of functions that are valid indirect branch targets, an attacker can no longer jump into the middle of a function to pick up a useful instruction sequence. The reachable set shrinks from arbitrary offsets across the binary down to function entry points.

![Flowchart showing indirect call with corrupted pointer](Images/2-2-B.jpeg "Forward edge control-flow attack blocked by IBT")

### Why You Need Both

It is tempting to think one mechanism might be enough, but they have very different coverage.

Shadow stack alone stops ROP. But an attacker who avoids `ret` entirely, chaining through `jmp` or `call` instructions instead, is running JOP or COP and the shadow stack never triggers.

IBT alone stops JOP and COP. But classic ROP chains built entirely from `ret`-ending gadgets sail right through, because `ret` is not an indirect branch from IBT's perspective.

With both running, the attacker's options get very tight. Every return has to match the shadow stack. Every indirect branch has to land on an `endbr`. There is still one remaining gap, which Section 5.4 covers, but the attack surface is dramatically smaller.

![Venn diagram of shadow stack and IBT coverage overlap](Images/2-2-C.jpeg "Combined coverage from shadow stack and IBT")

---

## 2.3 The Two Components in Detail

CET is two independent hardware extensions. You can enable either one without the other, though in practice you want both.

### Shadow Stack (SHSTK)

The shadow stack is a second stack, maintained by the CPU, that holds only return addresses. It lives in its own protected memory region. No regular load or store instruction can write to it. A separate register, the Shadow Stack Pointer (SSP), tracks the top, independent of RSP.

![Shadow stack region with SSP pointer schematic](Images/2-3-A.jpeg "Shadow stack layout and SSP pointer")

**Key properties**

| Property | Detail |
|----------|--------|
| Managed by | CPU hardware automatically |
| Write protection | Immune to normal store instructions |
| Contents | Return addresses only, nothing else |
| Pointer register | SSP, separate from RSP |
| Fault type | Control Protection fault (`#CP`, vector 21) |

Several new instructions expose shadow stack state to privileged software. The OS needs these for things like signal delivery and `setjmp`/`longjmp`, where the return chain legitimately changes.

* `RDSSPD` / `RDSSPQ` read the current SSP value.
* `INCSSP` moves the SSP forward by a specified number of entries, effectively discarding saved addresses.
* `SAVEPREVSSP` records the SSP before a stack switch.
* `RSTORSSP` restores a previously saved SSP.
* `WRSS` / `WRSSQ` write a value to the shadow stack directly. These are privileged and used by the OS, not application code.
* `SETSSBSY` marks a shadow stack token as busy to prevent reuse.
* `CLRSSBSY` clears that marker.

![Instruction summary for managing the shadow stack](Images/2-3-B.jpeg "Shadow stack management instructions")

Section 3 goes through each of these with concrete examples.

### Indirect Branch Tracking (IBT)

IBT enforces a simple rule: every indirect call or jump must land on an `endbr` instruction. No exceptions, unless the branch carries a `NOTRACK` prefix.

**Key properties**

| Property | Detail |
|----------|--------|
| Enforcement mechanism | CPU internal tracker state |
| Valid landing sites | `endbr64` or `endbr32` only |
| Older CPU behavior | `endbr` executes as a harmless NOP |
| Fault type | Control Protection fault (`#CP`, vector 21) |
| Explicit bypass | `NOTRACK` prefix on a specific branch |

Compilers decide where to put `endbr`. In general, it goes at the start of:

* Any externally visible function
* Any function whose address is ever taken (stored in a pointer, passed as a callback)
* Virtual methods in C++ classes
* Jump table targets generated for `switch` statements

On CET hardware the instruction acts as a landing pad marker. On older hardware it is a NOP, so the binary is identical in both cases.

![State machine for indirect branch tracking](Images/2-3-C.jpeg "IBT state machine enforcing endbr landing pads")

Section 4 covers the tracker state machine and what happens when the fault fires.

### When Both Run Together

With SHSTK and IBT both enabled, the coverage looks like this:

```
                 +------------------------------------------+
                 |           CET Enforcement                |
                 |                                          |
  call [rax] --> | IBT: next instruction must be endbr      |
                 |                                          |
  ret        --> | SHSTK: must match the saved address      |
                 |                                          |
                 | Either fails --> #CP fault --> process   |
                 +------------------------------------------+
```

A practical attacker now runs into at least one wall no matter what technique they try:

* ROP chains touch `ret`, so SHSTK catches the corrupted address.
* JOP and COP chains touch indirect branches, so IBT rejects gadgets that do not start with `endbr`.
* Hybrid chains that mix both hit whichever check comes first.

The one remaining option is to redirect an indirect branch to a different function that legitimately has an `endbr`. That is still a real limitation and worth understanding, but the number of usable targets drops from thousands of arbitrary gadget offsets to the much smaller set of function entry points in the binary. In practice, building a reliable exploit chain from that set is considerably harder.

![Shielded control flow with SHSTK and IBT checkpoints](Images/2-3-D.jpeg "Combined SHSTK and IBT enforcement on program flow")

---

## References

1. Intel Corporation. *Intel 64 and IA-32 Architectures Software Developer's Manual*, Combined Volumes, Version 091. Volume 1, Chapter 18: "Control-Flow Enforcement Technology (CET)." https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html
2. Intel Corporation. "A Technical Look at Intel Control-Flow Enforcement Technology." June 2020. https://www.intel.com/content/www/us/en/developer/articles/technical/technical-look-control-flow-enforcement-technology.html
3. Intel Corporation. *Intel 64 and IA-32 Architectures Software Developer's Manual*, Volume 3: System Programming Guide. Sections on CR4.CET, IA32_U_CET, and IA32_S_CET MSR configuration. https://cdrdv2.intel.com/v1/dl/getContent/671447
4. Burow, N., Carr, S. A., Nash, J., Larsen, P., Franz, M., Brunthaler, S., Payer, M. "Control-Flow Integrity: Precision, Security, and Performance." *ACM Computing Surveys*, Vol. 50, No. 1, Article 16, 2017. https://doi.org/10.1145/3054924
5. GCC. "Instrumentation Options: `-fcf-protection`." *GCC Online Documentation*. https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html
6. Shanbhogue, V., Gupta, D., Sahita, R. "Security Analysis of Processor Instruction Set Architecture for Enforcing Control-Flow Integrity." *Proceedings of the 8th International Workshop on Hardware and Architectural Support for Security and Privacy (HASP)*, 2019. https://doi.org/10.1145/3337167.3337175
