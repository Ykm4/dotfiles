---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Coding Standards

Design decisions and patterns that **cannot be enforced by linters or compilers**.
Formatting, compiler strictness, and lint-enforceable rules belong in project tooling (Biome, ESLint, tsconfig) — not here.

---

## Type Safety

### Never use `as` type assertions — use type guards or discriminated unions

`as` bypasses the type checker. The only exception is `as const`.

```typescript
// Bad
const user = response.data as User

// Good — type guard
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data
}
if (isUser(response.data)) {
  // response.data is User here
}

// OK — as const is allowed
const STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' } as const
```

### Never use non-null assertion (`!`) — use type narrowing

Non-null assertion (`!`) bypasses null checks. Use conditional expressions, type guards, or restructure code so TypeScript can narrow the type naturally.

```typescript
// Bad
const value = maybeNull!

// Good — inline conditional preserves narrowing
const { from, mode } =
  input !== undefined
    ? { from: input, mode: 'a' as const }
    : { from: fallback, mode: 'b' as const }
```

### Never use `enum` — use `as const` objects

TypeScript enums have tree-shaking issues, generate unexpected runtime code, and cannot be iterated cleanly.

```typescript
// Bad
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// Good
const Status = {
  Active: 'active',
  Inactive: 'inactive',
} as const
type Status = (typeof Status)[keyof typeof Status]
```

### Use `T[]` instead of `Array<T>`

`T[]` is shorter and more idiomatic. Use `T[]` for all array types, including readonly (`readonly T[]`).

```typescript
// Bad
const users: Array<User> = []
function getIds(items: ReadonlyArray<Item>): Array<string> { ... }

// Good
const users: User[] = []
function getIds(items: readonly Item[]): string[] { ... }
```

---

## Naming

### Prefix booleans with is/has/can/should

Boolean variables, parameters, and properties must clearly signal their type through naming.

```typescript
// Bad
const active = true
function visible(): boolean { ... }

// Good
const isActive = true
function isVisible(): boolean { ... }
```

---

## Design Patterns

### Use early returns to reduce nesting

Guard clauses at the top of functions. Avoid deep if-else nesting.

```typescript
// Bad
function process(user: User | null) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        return doWork(user)
      }
    }
  }
  return null
}

// Good
function process(user: User | null) {
  if (!user) return null
  if (!user.isActive) return null
  if (!user.hasPermission) return null

  return doWork(user)
}
```

### Use an options object when a function has 3+ parameters

Named properties are self-documenting and extensible without breaking call sites.

```typescript
// Bad
function createUser(name: string, email: string, role: string, isActive: boolean) { ... }

// Good
type CreateUserInput = {
  name: string
  email: string
  role: string
  isActive?: boolean
}
function createUser(input: CreateUserInput) { ... }
```

### Single responsibility per function

A function does one thing. Separate computation from side effects.

```typescript
// Bad — mixes validation, transformation, and persistence
function registerUser(input: unknown) {
  if (!input.email) throw new Error('missing email')
  const user = { ...input, createdAt: new Date() }
  db.insert(user)
  sendWelcomeEmail(user)
  return user
}

// Good — each function has one job
function parseRegistration(input: unknown): RegistrationData {
  return registrationSchema.parse(input)
}

function buildUser(data: RegistrationData): User {
  return { ...data, createdAt: new Date() }
}

// Side effects are handled by the caller (adapter/use-case layer)
```

### Prefer pure functions — push side effects to boundaries

Functions without side effects are easier to test, compose, and reason about.
Keep I/O, logging, and mutation at the adapter layer. Core logic should be pure.

```typescript
// Bad — pure logic mixed with I/O
function calculateDiscount(userId: string): number {
  const user = db.findUser(userId)       // side effect
  console.log(`Calculating for ${user}`) // side effect
  return user.purchaseCount > 10 ? 0.1 : 0
}

// Good — pure calculation, I/O handled by caller
function calculateDiscount(purchaseCount: number): number {
  return purchaseCount > 10 ? 0.1 : 0
}
```

### Use Interface + DI at external boundaries

Define an Interface (Port) at each external dependency boundary (DB, external API, message queue, etc.).
Inject implementations via constructor DI. Core logic depends only on Ports, never on concrete libraries.

```typescript
// Port — defined in core layer
interface UserRepository {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<User>
}

// Adapter — implements the Port with a concrete library
class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findById(id: string) { return this.prisma.user.findUnique({ where: { id } }) }
  async save(user: User) { return this.prisma.user.create({ data: user }) }
}

// Use Case — depends only on the Port
class CreateUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}
  async execute(input: CreateUserInput) {
    return this.userRepo.save(buildUser(input))
  }
}
```

Do NOT create Ports for internal utilities (date formatting, string helpers, etc.) — only for external I/O boundaries.
Class inheritance (`extends`) is acceptable only for custom errors and framework requirements.

### Model states with discriminated unions

Use a literal `type` or `status` field to distinguish states. Enables exhaustive checking.

```typescript
// Bad — optional fields for different states
type Order = {
  id: string
  status: string
  shippedAt?: Date
  cancelledAt?: Date
  cancelReason?: string
}

// Good — each state is its own branch
type Order =
  | { id: string; status: 'pending' }
  | { id: string; status: 'shipped'; shippedAt: Date }
  | { id: string; status: 'cancelled'; cancelledAt: Date; cancelReason: string }

// Exhaustive check
function handleOrder(order: Order) {
  switch (order.status) {
    case 'pending': return processPending(order)
    case 'shipped': return processShipped(order)
    case 'cancelled': return processCancelled(order)
    default: order satisfies never
  }
}
```

### Prefer immutability — const, readonly, spread

Default to `const`. Use `readonly` for properties not reassigned after construction.
Update objects via spread instead of mutation.

```typescript
// Bad
let count = 0
count = count + 1

const user = { name: 'Alice', role: 'admin' }
user.role = 'member' // mutation

// Good
const count = 0
const newCount = count + 1

const user = { name: 'Alice', role: 'admin' } as const
const updatedUser = { ...user, role: 'member' as const }

// Good — readonly class properties
class UserService {
  constructor(private readonly repository: UserRepository) {}
}
```

### Write range checks as a number-line reading left to right

Place bounds on the outside so the condition reads like a number line: `MIN --- value --- MAX`.

```typescript
// Bad — inconsistent reading direction
if (value < MIN || value > MAX)

// Good — reads as "MIN > value (too small) OR value > MAX (too large)"
if (MIN > value || value > MAX)
```

---

## Async Patterns

### Use `Promise.all` vs `Promise.allSettled` intentionally

- `Promise.all`: All must succeed. Fails fast on first rejection.
- `Promise.allSettled`: Partial failures acceptable. Always resolves.

```typescript
// All-or-nothing
const [user, roles] = await Promise.all([
  fetchUser(id),
  fetchRoles(id),
])

// Partial failure OK
const results = await Promise.allSettled([
  sendEmail(user),
  sendSlack(user),
  sendPush(user),
])
const failures = results.filter((r) => r.status === 'rejected')
```
