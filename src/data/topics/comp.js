export const compTopics = Object.freeze(
  [
  {
    "code": "COMP.01",
    "c": "comp",
    "t": "How the Internet Actually Works",
    "h": "Packets, TCP/IP, and the fact that nothing in the middle knows or cares what you are sending.",
    "w": "how the internet works packets TCP IP explained",
    "r": "Internet protocol suite"
  },
  {
    "code": "COMP.02",
    "c": "comp",
    "t": "DNS",
    "h": "A globally distributed, cached, hierarchical database that turns names into addresses. Also why half of all outages are DNS.",
    "w": "how DNS works explained",
    "r": "Domain Name System"
  },
  {
    "code": "COMP.03",
    "c": "comp",
    "t": "BGP",
    "h": "The routing protocol running on trust. One misconfiguration can black hole traffic for an entire continent.",
    "w": "BGP routing explained hijack",
    "r": "Border Gateway Protocol"
  },
  {
    "code": "COMP.04",
    "c": "comp",
    "t": "Public Key Cryptography",
    "h": "Two keys, one shared freely. The counterintuitive idea that made private communication over a hostile network possible.",
    "w": "public key cryptography RSA Diffie Hellman explained",
    "r": "public-key cryptography"
  },
  {
    "code": "COMP.05",
    "c": "comp",
    "t": "Compilers",
    "h": "Lexing, parsing, IR, optimisation, codegen. Writing even a small one permanently changes how you read code.",
    "w": "how compilers work lexer parser codegen explained",
    "r": "compiler"
  },
  {
    "code": "COMP.06",
    "c": "comp",
    "t": "Kernels & Scheduling",
    "h": "Context switches, interrupts, and the scheduler deciding who runs next. The layer your abstractions are lying about.",
    "w": "operating system kernel scheduler explained",
    "r": "scheduling computing"
  },
  {
    "code": "COMP.07",
    "c": "comp",
    "t": "ACID & Isolation Levels",
    "h": "Isolation levels are where most correctness bugs hide. Serializable is not the default, and you should know why.",
    "w": "database transactions ACID isolation levels explained",
    "r": "isolation database systems"
  },
  {
    "code": "COMP.08",
    "c": "comp",
    "t": "Distributed Consensus",
    "h": "Paxos, Raft, and CAP: how machines that can lie, lag, or die still agree on a single value.",
    "w": "Raft consensus algorithm CAP theorem explained",
    "r": "consensus computer science"
  },
  {
    "code": "COMP.09",
    "c": "comp",
    "t": "The Halting Problem",
    "h": "Some problems are not hard, they are impossible. Turing drew the line and nothing crosses it.",
    "w": "Turing machine halting problem explained",
    "r": "halting problem"
  },
  {
    "code": "COMP.10",
    "c": "comp",
    "t": "How Transformers Work",
    "h": "Attention, embeddings, and next token prediction. The architecture behind every model you currently use.",
    "w": "transformer architecture attention explained",
    "r": "transformer deep learning"
  },
  {
    "code": "COMP.11",
    "c": "comp",
    "t": "Compression",
    "h": "Huffman coding, entropy, and the proof that a universal lossless compressor cannot exist. Directly downstream of thermodynamics.",
    "w": "data compression Huffman entropy explained",
    "r": "data compression"
  },
  {
    "code": "COMP.12",
    "c": "comp",
    "t": "The Memory Hierarchy",
    "h": "Registers to cache to RAM to disk, each roughly two orders of magnitude slower. Cache locality is most of real performance.",
    "w": "CPU cache memory hierarchy explained",
    "r": "CPU cache"
  },
  {
    "code": "COMP.13",
    "c": "comp",
    "t": "Floating Point",
    "h": "Why 0.1 plus 0.2 is not 0.3, and why IEEE 754 is nonetheless a masterpiece of engineering compromise.",
    "w": "IEEE 754 floating point explained",
    "r": "IEEE 754"
  }
].map(Object.freeze),
);
