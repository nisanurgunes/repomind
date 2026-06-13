# English Interview Study Notes — Nisanur Güneş
> Backend Developer | Spring Boot · FastAPI · Kotlin · Python  
> Prepared based on your lecture notes + CV experience

---

## HOW TO USE THESE NOTES
- Each section has a **concept summary** + **likely interview questions** + **your answer angle** (tied to your real experience)
- Starred ⭐ = high probability question for backend roles
- Mark sections as you review them

---

# SECTION 1 — OOP (Object-Oriented Programming)

## The 4 Pillars

### 1. Encapsulation
Hiding internal state; only exposing via getters/setters.

```java
class BankAccount {
    private double balance;  // can't access directly
    public double getBalance() { return balance; }
    public void deposit(double amount) { ... }
}
```

**Why it matters:** Prevents invalid state (e.g., `account.balance = -99999`). Forces logic through controlled methods.

⭐ **Q: What is encapsulation? Give a real example.**  
→ *"In my work at DiscoverGames, every domain entity had private fields with controlled access. For example, deal status transitions (pending → approved → completed) were only done through service methods, never by directly mutating the field — that's encapsulation enforcing business rules."*

---

### 2. Abstraction
Hiding implementation details; exposing only what the caller needs.

```java
interface PaymentService {
    void pay(double amount);
}
// Caller does: PaymentService p = ...; p.pay(100);
// Doesn't care if it's Stripe, PayPal, etc.
```

**Key distinction from encapsulation:** Encapsulation = hiding *data*. Abstraction = hiding *complexity*.

⭐ **Q: Difference between abstraction and encapsulation?**  
→ Encapsulation hides fields (data); abstraction hides implementation (how things work). Both reduce coupling but at different levels.

---

### 3. Inheritance
Child class inherits behavior from parent. Enables code reuse.

```java
class Animal { void speak() { System.out.println("..."); } }
class Dog extends Animal { 
    @Override void speak() { System.out.println("Bark"); } 
}
```

**Important:** Java supports single inheritance for classes, but multiple for interfaces.

**When to prefer composition over inheritance:**  
If you only want to reuse behavior (not establish an is-a relationship), use composition. Inheritance creates tight coupling.

---

### 4. Polymorphism

**Compile-time (Overloading):** Same method name, different parameter types. Resolved at compile time.
```java
int add(int a, int b)
double add(double a, double b)
```

**Runtime (Overriding):** Subclass overrides parent method. Resolved at runtime.
```java
Animal a = new Dog();
a.speak(); // → "Bark" (runtime polymorphism)
a.bark();  // compile error — Animal has no bark()
```

⭐ **Q: What's the difference between overloading and overriding?**  
→ Overloading = same name, different signature, same class, compile-time. Overriding = same signature, different class (parent-child), runtime.

---

## Int vs Integer (Java)

| | `int` | `Integer` |
|---|---|---|
| Type | Primitive | Object (Wrapper) |
| Memory | Stack | Heap |
| Null | ❌ | ✅ |
| Collections | ❌ | ✅ |
| Performance | Faster | Slower (boxing overhead) |

**Autoboxing:** Java auto-converts `int ↔ Integer`.
```java
Integer x = 5;       // autoboxing: int → Integer
int y = x;           // unboxing: Integer → int
```

**Gotcha — Integer cache:** `Integer` caches values -128 to 127. So:
```java
Integer a = 100, b = 100;
a == b   // true (cached, same object)

Integer c = 200, d = 200;
c == d   // FALSE (new objects)
c.equals(d) // true ← always use .equals() for Integer comparison
```

⭐ **Q: When would Integer.equals() and == give different results?**

---

## Immutable Classes

An object whose state cannot change after construction.

**Rules:**
1. Class must be `final` (can't be extended)
2. All fields `private final`
3. No setters
4. If field is a mutable object (List, etc.) → return a **defensive copy**

```java
final class Immu {
    private final String name;
    private final int age;
    public Immu(String name, int age) { this.name = name; this.age = age; }
    public String getName() { return name; }
}
```

**String is immutable:** `s = s.toUpperCase()` creates a new String — doesn't mutate the original.

**Why immutability matters for concurrency:** Multiple threads can safely read the same immutable object without synchronization.

**Defensive copy example:**
```java
// Bad — caller can mutate your internal list
public List<String> getItems() { return items; }

// Good — return copy
public List<String> getItems() { return new ArrayList<>(items); }
```

⭐ **Q: How do you make a class immutable in Java? What about classes with mutable fields?**

---

## Thread Safety

Ways to make code thread-safe:
1. **Use immutable objects** — no shared mutable state
2. **Synchronized blocks/methods**
3. **`volatile` keyword** — visibility guarantee
4. **Atomic classes** — `AtomicInteger`, `AtomicReference`
5. **Concurrent collections** — `ConcurrentHashMap`, `CopyOnWriteArrayList`

---

# SECTION 2 — Java Exceptions

## Checked vs Unchecked

| | Checked | Unchecked |
|---|---|---|
| When detected | Compile-time | Runtime |
| Must handle? | ✅ (try/catch or throws) | ❌ (optional) |
| Examples | `IOException`, `SQLException` | `NullPointerException`, `ArrayIndexOutOfBoundsException`, `IllegalArgumentException` |
| Extends | `Exception` | `RuntimeException` |

```java
// Checked — compiler forces you to handle
try {
    FileReader f = new FileReader("file.txt");
} catch (IOException e) { ... }

// Unchecked — runtime, no forced handling
String s = null;
s.length(); // NullPointerException
```

**Custom Exception:**
```java
public class PaymentFailedException extends RuntimeException {
    public PaymentFailedException(String message) {
        super(message);
    }
}
```

**Spring `@ControllerAdvice` / `@ExceptionHandler`:**
```java
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(PaymentFailedException.class)
    public ResponseEntity<?> handle(PaymentFailedException e) {
        return ResponseEntity.status(400).body(e.getMessage());
    }
}
```

⭐ **Q: When would you use a checked vs unchecked exception?**  
→ Checked for *recoverable* conditions the caller should handle (file not found — maybe ask user to retry). Unchecked for programming errors (null where not expected) or unrecoverable conditions.

---

# SECTION 3 — SOLID Principles

## S — Single Responsibility Principle
**One class, one reason to change.**

Bad: `OrderService` doing createOrder + sendEmail + saveToDB  
Good: `OrderService`, `EmailService`, `OrderRepository` — each owns one concern.

⭐ **Q: Can you give an example of SRP violation and how you'd fix it?**  
→ *"At DiscoverGames, we initially had a service that handled both deal validation and notification sending. We split it — deal logic stayed in `DealService`, notifications moved to `NotificationService`. This also made it easier to test each in isolation with JUnit/Mockito."*

---

## O — Open/Closed Principle
**Open for extension, closed for modification.**

Bad: `if type == "credit" ... else if type == "paypal"` — every new payment type changes existing code.

Good:
```java
interface PaymentStrategy { void pay(double amount); }
class CreditCardPayment implements PaymentStrategy { ... }
class PayPalPayment implements PaymentStrategy { ... }
// Add new type → new class, no existing code changes
```

---

## L — Liskov Substitution Principle
**Subclass should be substitutable for parent without breaking behavior.**

Bad violation:
```java
interface Bird { void fly(); }
class Penguin implements Bird {
    void fly() { throw new Exception("Can't fly!"); } // breaks LSP
}
```

Fix: Split the interface — `FlyingBird extends Bird` with `fly()`. Penguin implements `Bird` only.

⭐ **Q: What does LSP mean in practice?**  
→ If you replace a parent class reference with a subclass, code should still work correctly. Violations usually show up as unexpected exceptions or ignored methods in subclasses.

---

## I — Interface Segregation Principle
**Don't force classes to implement methods they don't use.**

Bad: One fat interface with `print()`, `scan()`, `fax()` — a simple printer implements all three but only uses print.

Good: Separate `Printer`, `Scanner`, `Fax` interfaces. Classes implement only what they need.

---

## D — Dependency Inversion Principle
**High-level modules should not depend on low-level modules. Both should depend on abstractions.**

Bad: `OrderService` creates `new PaymentService()` internally → tightly coupled.

Good (Spring DI):
```java
@Service
class OrderService {
    private final PaymentService paymentService; // injected
    OrderService(PaymentService paymentService) {
        this.paymentService = paymentService;
    }
}
```

⭐ **Q: How does Spring implement DIP?**  
→ Through IoC (Inversion of Control) — the Spring container creates and injects dependencies. We define what we need via constructor injection or `@Autowired`, Spring figures out how to provide it.

---

# SECTION 4 — Spring Boot Deep Dive

## Dependency Injection & IoC

**IoC (Inversion of Control):** Instead of your code creating dependencies, the framework does it and gives them to you.

**DI types:**
- **Constructor injection** ← recommended (immutable, testable, detects circular deps)
- Field injection (`@Autowired` on field) — convenient but harder to test
- Setter injection — rare

**Spring Bean lifecycle:**
1. App starts → Spring scans for `@Component`, `@Service`, `@Repository`, `@Controller`
2. Creates instances
3. Injects dependencies
4. Runs `@PostConstruct`
5. Bean is ready to use

**@Service vs @Component vs @Repository:**
- `@Component` — generic bean
- `@Service` — business logic layer (semantic)
- `@Repository` — data access layer + automatic exception translation (converts DB exceptions to Spring `DataAccessException`)

**Circular Dependency:**  
A → needs B → needs A → deadlock at startup.  
Fix: `@Lazy` on one of them, or refactor to break the cycle.

⭐ **Q: What's the difference between @Service and @Component?**

---

## Bean Scope

| Scope | Description |
|---|---|
| `singleton` (default) | One instance per Spring container |
| `prototype` | New instance per injection |
| `request` | One per HTTP request (web) |
| `session` | One per HTTP session (web) |

---

## JPA & Hibernate

**JPA** = Java Persistence API (spec). **Hibernate** = implementation.

**Key annotations:**
```java
@Entity
@Table(name = "orders")
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
    private List<OrderItem> items;
    
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
}
```

**Fetch Types:**
- `LAZY` — loads related entities only when accessed (default for collections)
- `EAGER` — loads related entities immediately with parent

---

## N+1 Problem ⭐⭐⭐

**The classic ORM performance trap.**

```java
List<Order> orders = orderRepository.findAll(); // 1 query
for (Order o : orders) {
    o.getItems().size(); // N queries — one per order!
}
// Total: N+1 queries
```

**Solutions:**

1. **JOIN FETCH (JPQL):**
```java
@Query("SELECT o FROM Order o JOIN FETCH o.items")
List<Order> findAllWithItems();
```

2. **`@EntityGraph`:**
```java
@EntityGraph(attributePaths = {"items"})
List<Order> findAll();
```

3. **`@BatchSize`** — loads related entities in batches instead of one by one.

4. **Use DTOs** with native queries — skip entity proxy entirely.

⭐ **Q: What is the N+1 problem? How did you encounter it and how did you fix it?**

---

## Hibernate Proxy & LazyInitializationException

When you load an entity with lazy relationships, Hibernate gives you a **proxy** object (a fake placeholder). When you access the lazy field, Hibernate issues a query.

**`LazyInitializationException`** occurs when you access a lazy field **outside an active transaction** (after the session is closed).

**Fix:**
- Keep the transaction open when accessing lazy fields (use `@Transactional`)
- Use DTOs — fetch only what you need in one query
- Use `JOIN FETCH`

```java
// This will throw LazyInitializationException if called outside @Transactional
Order o = orderRepository.findById(1L);
o.getItems(); // session already closed → BOOM
```

---

## @Transactional

Wraps a method in a database transaction — all-or-nothing.

```java
@Transactional
public void transferFunds(Long from, Long to, double amount) {
    accountRepo.debit(from, amount);
    accountRepo.credit(to, amount); // if this fails, debit also rolls back
}
```

**Propagation types (common):**
- `REQUIRED` (default) — join existing tx or create new
- `REQUIRES_NEW` — always create new tx (suspends existing)
- `SUPPORTS` — join if exists, run without tx if not

**Common gotcha:** `@Transactional` only works on public methods called through the Spring proxy. Calling a `@Transactional` method from *within the same class* won't trigger the transaction.

⭐ **Q: What does @Transactional do and when would it NOT work?**

---

# SECTION 5 — ACID & Database

## ACID Properties

### A — Atomicity
"All or nothing" — either the entire transaction succeeds or it fully rolls back.  
→ No partial updates.

### C — Consistency
Transaction must leave the database in a valid state.  
→ All constraints, foreign keys, business rules satisfied.

### I — Isolation
Concurrent transactions don't interfere with each other.  
→ Different isolation levels control what concurrent transactions can see.

### D — Durability
Once committed, data persists even if the system crashes.  
→ WAL (Write-Ahead Log), crash recovery.

---

## Isolation Levels (from weakest to strongest)

| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| READ UNCOMMITTED | ✅ possible | ✅ | ✅ |
| READ COMMITTED | ❌ | ✅ possible | ✅ |
| REPEATABLE READ | ❌ | ❌ | ✅ possible |
| SERIALIZABLE | ❌ | ❌ | ❌ |

- **Dirty Read:** Reading uncommitted changes from another transaction
- **Non-Repeatable Read:** Same query returns different results within the same transaction
- **Phantom Read:** New rows appear in a repeated query (another tx inserted them)

PostgreSQL default: **READ COMMITTED**  
MySQL/InnoDB default: **REPEATABLE READ**

Spring:
```java
@Transactional(isolation = Isolation.READ_COMMITTED)
```

⭐ **Q: What's the difference between READ COMMITTED and REPEATABLE READ?**

---

# SECTION 6 — Microservices & Distributed Systems

## Loose vs Tight Coupling

**Tight coupling:** ServiceA directly calls ServiceB's concrete implementation. If B changes, A breaks.

**Loose coupling:** Services communicate through abstractions (interfaces, message queues). Changes to one service don't ripple.

**How to achieve loose coupling:**
- Use message queues (Kafka, SQS, RabbitMQ) for async communication
- Define API contracts (OpenAPI spec)
- Program to interfaces, not implementations
- Event-driven architecture

*Your experience:* You implemented SQS batch processing at DiscoverGames — this is exactly loose coupling. OrderService emits events; InventoryService consumes them without knowing who sent them.

---

## Saga Pattern ⭐⭐

Manages distributed transactions across multiple microservices where a single ACID transaction isn't possible (different DBs).

**Problem:** Order → Inventory → Payment — each has its own database. You can't do an atomic transaction across all three.

**Solution 1: Choreography (Event-driven)**
Each service emits events; the next service listens and reacts. No central coordinator.

```
Order created event → 
    Inventory service listens → reserves stock → StockReserved event →
        Payment service listens → charges card → PaymentCompleted event →
            Order service listens → marks order complete
```

**Compensation (rollback):** If payment fails:
- Payment emits `PaymentFailed`
- Inventory listens → releases stock (StockReleased)
- Order listens → marks order cancelled

**Solution 2: Orchestration**  
A central orchestrator tells each service what to do and tracks state.
```
Orchestrator → "Reserve stock" → Inventory
Orchestrator → "Charge payment" → Payment
Orchestrator → "Ship order" → Shipping
```

| | Choreography | Orchestration |
|---|---|---|
| Complexity | Distributed (harder to trace) | Central (easier to trace) |
| Coupling | Loose | Tighter (all know orchestrator) |
| Error handling | Complex compensation chains | Orchestrator manages rollback |

⭐ **Q: What is the Saga pattern and when would you use choreography vs orchestration?**  
→ *You can tie this to your real SQS pipeline work — it IS a saga choreography pattern.*

---

## Outbox Pattern

**Problem:** You save to DB and then publish an event. What if the publish fails after DB commit? Data is inconsistent.

**Solution:** Write the event to an `outbox` table in the same DB transaction as your data change. A separate process polls the outbox and publishes events.

```
Transaction: {
    INSERT INTO orders (...)
    INSERT INTO outbox (event_type, payload, sent=false)
}
// Separate process:
SELECT * FROM outbox WHERE sent = false
→ Publish to Kafka/SQS
→ UPDATE outbox SET sent = true
```

**Guarantees:** At-least-once delivery. Make consumers idempotent.

---

## Dead Letter Queue (DLQ)

When a message fails processing after all retries, it's moved to the DLQ instead of blocking the main queue.

**Use cases:**
- Poison messages (malformed, will never succeed)
- Investigate failures without losing messages

*Your SQS work directly applies here — mention DLQ configuration for failed batch items.*

---

## Circuit Breaker ⭐

Prevents cascading failures when a downstream service is down.

**States:**
1. **Closed (normal):** Requests pass through. Failure count tracked.
2. **Open (tripped):** Service is down. All requests fail fast with fallback. No actual calls made.
3. **Half-Open (testing):** A few test requests let through. If they succeed → back to Closed. If fail → back to Open.

**Why important:** Without it, slow/down service causes connection pool exhaustion, timeouts cascade, your whole system goes down.

**Fallback:** When circuit is open, return a cached result, a default response, or an error message instead of hanging.

```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
public PaymentResult callPayment(Order o) { ... }

public PaymentResult paymentFallback(Order o, Exception e) {
    return PaymentResult.ofError("Payment service unavailable");
}
```

*Resilience4j is the standard library for this in Spring Boot.*

---

## API Gateway

Entry point for all client requests. Routes to appropriate microservices.

**Responsibilities:**
- Routing
- Authentication / Authorization
- Rate limiting
- Logging / tracing
- Request aggregation (combine multiple service calls)
- SSL termination

---

## Fault Tolerance

Key patterns:
- **Retry** with exponential backoff
- **Timeout** — don't wait forever
- **Circuit Breaker** — fail fast
- **Bulkhead** — isolate failures (separate thread pools per service)
- **Idempotency** — safe to retry (same request → same result)

*You implemented retry strategies and idempotent processing at DiscoverGames — this is your answer.*

---

# SECTION 7 — Messaging: Kafka vs RabbitMQ vs SQS

## Amazon SQS (your experience ⭐)

- Fully managed queue service
- **Standard queues:** at-least-once delivery, unordered
- **FIFO queues:** exactly-once, ordered
- **Batch processing:** up to 10 messages per batch
- **Visibility timeout:** message hidden from other consumers while being processed
- **DLQ:** failed messages after max retries

*Your DevPulse: "~500 records processed in batches of 50 via SQS" — describe the consumer, batch size logic, and DLQ setup.*

---

## Kafka vs RabbitMQ

| Feature | Kafka | RabbitMQ |
|---|---|---|
| Model | Log/offset-based (pull) | Queue-based (push) |
| Replay | ✅ (seek to offset) | ❌ (message gone after ack) |
| Throughput | Very high | High |
| Ordering | Per partition | Per queue |
| Routing | Topic/partition | Exchange + binding rules |
| Use case | Event streaming, audit log | Task queues, RPC |

**Key Kafka concepts:**
- **Topic** — category of messages
- **Partition** — parallelism unit; ordered within a partition
- **Consumer group** — partitions distributed among consumers in a group
- **Offset** — position of a message in a partition (allows replay)
- **Retention** — messages kept for configurable time (default 7 days)

⭐ **Q: When would you choose Kafka over RabbitMQ?**  
→ Kafka for high-volume event streaming, audit trails, replay needed. RabbitMQ for simpler routing, task queues, lower volume.

---

# SECTION 8 — Networking Fundamentals

## OSI Model (layers you need)

| Layer | Name | Protocol |
|---|---|---|
| 7 | Application | HTTP, gRPC, WebSocket |
| 4 | Transport | TCP, UDP |
| 3 | Network | IP |
| 2 | Data Link | Ethernet |
| 1 | Physical | Cables |

## HTTP vs TCP

**TCP:** Raw byte stream. Handles: connection establishment (3-way handshake), reliability, ordering, flow control.

**HTTP:** Application protocol *on top of TCP*. Defines: request/response format, headers, status codes, body encoding (JSON).

**3-way handshake:**  
Client: SYN → Server: SYN-ACK → Client: ACK → Connection established

**HTTP/2 vs HTTP/1.1:** HTTP/2 uses multiplexing (multiple requests on one connection), header compression, binary framing → significantly faster.

## Common Network Issues

- **Timeout** → Service unreachable or slow
- **Connection reset** → Server closed connection unexpectedly
- **Packet loss** → Retransmission needed

**Debugging tools:** ping (ICMP reachability), curl (HTTP), netstat (connections), traceroute (routing path)

---

# SECTION 9 — Java Memory: Stack vs Heap

## Stack
- **LIFO** structure
- Stores: primitive variables, method call frames, local references
- Fast allocation/deallocation
- Thread-local (each thread has its own stack)
- Fixed size → **StackOverflowError** if exceeded (infinite recursion)

## Heap
- Stores: all objects (class instances, arrays)
- Shared across threads → **thread safety issues** possible
- Managed by **Garbage Collector**
- Larger but slower than stack

```java
int x = 10;          // x lives in Stack
String s = "hello";  // s (reference) in Stack, "hello" object in Heap
int[] arr = {1,2,3}; // arr (reference) in Stack, array in Heap
```

## String Pool
String literals are cached in a special area of Heap:
```java
String a = "java";   // goes to String pool
String b = "java";   // reuses same object from pool
a == b;              // true (same reference)

String c = new String("java"); // forces new Heap object
a == c;              // false
a.equals(c);         // true ← use .equals() for content comparison
```

## Garbage Collection
- Automatically frees heap memory when objects have no more references
- GC algorithms: Serial, Parallel, G1 (default in Java 9+), ZGC
- **Stop-the-world:** GC pauses all threads briefly (minimized in modern GCs)

⭐ **Q: What's the difference between Stack and Heap? Where are objects stored?**

---

# SECTION 10 — System Design Patterns (Advanced)

## Event-Driven Architecture
Your strongest real experience. Key points to articulate:
- Services communicate via events (not direct calls)
- Producer publishes event, consumers react independently
- **Benefits:** loose coupling, scalability, resilience
- **Challenges:** eventual consistency, debugging (distributed tracing needed), ordering

*Your SQS pipeline + event triggers at DiscoverGames = event-driven. Mention: idempotency, retry logic, batch processing.*

## CQRS (Command Query Responsibility Segregation)
Separate read model from write model. Writes go to command side; reads optimized separately. Often paired with Event Sourcing.

## Event Sourcing
Instead of storing current state, store the full history of events. Current state = replay of all events. Enables time travel, audit log, replay.

---

# SECTION 11 — Build Tools & Dependency Management

## Maven vs Gradle

| | Maven | Gradle |
|---|---|---|
| Config | XML (`pom.xml`) | Groovy/Kotlin DSL (`build.gradle`) |
| Speed | Slower | Faster (incremental builds, caching) |
| Verbosity | More verbose | Less code |
| Convention | Strict | Flexible |

**JAR vs WAR vs Fat JAR:**
- **JAR** — Java Archive, for standalone apps
- **WAR** — Web Archive, deployed to servlet container (Tomcat)
- **Fat/Uber JAR** — includes all dependencies inside → `java -jar app.jar` just works (Spring Boot default)

---

# SECTION 12 — Elasticsearch Basics

**Why not a regular DB?** SQL `LIKE '%name%'` does a full table scan — O(n). Very slow on large datasets.

**Elasticsearch:** Inverted index — for each word, stores which documents contain it → O(1) lookup.

```
Normal DB index: ID → document
Elasticsearch:   word → [doc1, doc5, doc12...]
```

**Use cases:** Full-text search, log aggregation (ELK stack), analytics.

---

# SECTION 13 — Your DevPulse Project (Interview Talking Points)

Use this for behavioral/system design questions.

**Architecture:** FastAPI (async Python) + PostgreSQL (Supabase) + Next.js 14. GitHub OAuth2 + JWT. Deployed on Render + Vercel.

**Interesting technical decisions:**
1. **Async SQLAlchemy** — needed for high-concurrency GitHub API calls. Tradeoff: more complex session management vs performance.
2. **pgbouncer compatibility** — had to set `statement_cache_size=0` because Supabase uses a connection pooler that doesn't support prepared statements.
3. **Alembic auto-migration on startup** — used subprocess in FastAPI lifespan to run `alembic upgrade head` on Render (no shell access in free tier).
4. **Event-driven notification system** — commit push/score drop triggers.
5. **Organization management** — multi-tenant model, invite tokens, role-based access (owner/admin/member).

⭐ **Q: Tell me about a challenging technical problem you solved.**  
→ Use any of the above — the pgbouncer issue or the async migration are great concrete stories.

---

# SECTION 14 — Behavioral Interview Prep

## STAR Format (Situation → Task → Action → Result)

**"Tell me about a time you dealt with a production issue"**  
→ S: At DiscoverGames, our SQS consumer was processing duplicate events, causing double charges.  
→ T: I needed to make the consumer idempotent without blocking other messages.  
→ A: Added a transaction ID check before processing — if already processed, skip and ack. Added retry strategy for transient failures.  
→ R: Zero duplicate charges, consumer throughput improved because we eliminated unnecessary retries.

**"How do you handle disagreements with technical decisions?"**  
→ Provide data/analysis. If others disagree, implement their way first but propose a proof-of-concept for your approach. Let results speak.

**"What's your approach to learning new tech?"**  
→ Build something real with it (DevPulse was built specifically to learn async Python + Next.js in depth). Read the source code and docs, not just tutorials.

---

# SECTION 15 — Quick Review Checklist

Go through these the day before the interview:

**Java/Kotlin:**
- [ ] 4 OOP pillars with code examples
- [ ] Checked vs Unchecked exceptions
- [ ] Int vs Integer, autoboxing pitfalls
- [ ] Immutable class rules
- [ ] Stack vs Heap (where does each variable live?)

**Spring Boot:**
- [ ] @Service @Component @Repository differences
- [ ] Bean lifecycle and scopes
- [ ] DI — constructor vs field injection
- [ ] @Transactional propagation and gotchas
- [ ] N+1 problem and 3 solutions
- [ ] LazyInitializationException cause and fix

**Distributed Systems:**
- [ ] Saga pattern — choreography vs orchestration
- [ ] Outbox pattern — why and how
- [ ] Circuit Breaker — 3 states
- [ ] DLQ — purpose and configuration
- [ ] Kafka vs RabbitMQ vs SQS trade-offs

**Design Principles:**
- [ ] All 5 SOLID principles with real examples from your work
- [ ] ACID — all 4 properties
- [ ] Isolation levels — what each prevents

**Networking:**
- [ ] OSI layers (app, transport, network)
- [ ] HTTP vs TCP relationship
- [ ] 3-way handshake

---

# SECTION 16 — Things NOT in Your Notes (but likely asked)

These gaps are based on your CV + common backend interview patterns:

## REST API Design Best Practices
- Use nouns not verbs: `/orders` not `/getOrders`
- Correct HTTP methods: GET (idempotent), POST (create), PUT (replace), PATCH (partial), DELETE
- Correct status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 500 Internal Server Error
- Versioning: `/api/v1/orders`
- Pagination: `?page=0&size=20` or cursor-based

## JWT Authentication (your DevPulse experience)
```
Header.Payload.Signature
- Header: algorithm (HS256)
- Payload: user ID, roles, expiry (claims) — NOT encrypted, just base64
- Signature: HMAC of header+payload with secret key
```
**Refresh token pattern:** Short-lived access token (15min) + long-lived refresh token (30 days). Reduces exposure if access token is stolen.

**Stateless auth:** Server doesn't store sessions — any instance can validate any token.

## OAuth2 Flow (your experience)
1. User clicks "Login with GitHub"
2. Redirect to GitHub with `client_id`, `redirect_uri`, `scope`
3. User authorizes → GitHub redirects back with `code`
4. Backend exchanges `code + client_secret` for `access_token`
5. Use token to fetch user data from GitHub API

## Database Indexing
- **B-tree index** — default, good for equality and range queries
- **Composite index** — covers multiple columns; column order matters
- **Partial index** — index only rows matching a condition (e.g., `WHERE status = 'active'`)
- Don't over-index — slows down writes

```sql
-- Bad: full table scan
SELECT * FROM orders WHERE LOWER(email) = 'test@test.com';

-- Good: functional index
CREATE INDEX idx_email_lower ON orders (LOWER(email));
```

## Concurrency in Python (FastAPI context)
- FastAPI uses `asyncio` — cooperative multitasking
- `async def` endpoints run on the event loop (don't block)
- CPU-bound tasks should use `ProcessPoolExecutor` or background workers
- I/O-bound tasks: `await asyncio.sleep()`, `await db.execute()`
- `asyncpg` / async SQLAlchemy for non-blocking DB queries

## Docker Basics
```bash
docker build -t myapp .           # build image
docker run -p 8000:8000 myapp     # run container
docker-compose up                 # start all services
```
**Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]
```

---

# LAST-MINUTE PREP (day before interview)

1. **Re-read your CV** — be ready to deep-dive any bullet point
2. **Practice out loud** — explain N+1, Saga, Circuit Breaker in 60 seconds each
3. **Prepare 3 STAR stories** — production bug, technical disagreement, learning new tech
4. **Know your DevPulse architecture** — draw it mentally: frontend → API → DB, auth flow, notification flow
5. **Prepare questions to ask:** "What does a typical oncall rotation look like?", "How do you handle breaking API changes between services?", "What's your approach to database migrations in production?"

---

*Good luck, Nisanur! Your background is strong — SQS batch processing, OAuth2 integrations, event-driven systems, Spring Boot in production. These are exactly the topics that come up. Own your experience confidently.*
