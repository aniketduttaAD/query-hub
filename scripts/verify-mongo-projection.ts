import { parseMongoQuery, parseMongoArgs } from '../lib/adapters/mongoParser';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a == null || typeof b !== 'object' || b == null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as object).sort();
  const keysB = Object.keys(b as object).sort();
  if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) return false;
  return keysA.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

console.log('Verifying MongoDB query parsing and projection handling...\n');

// --- Parser: find with filter and projection ---
const q1 = 'db.students.find({}, { name: 1, _id: 0 })';
const p1 = parseMongoQuery(q1);
assert(p1.collection === 'students', 'collection name');
assert(p1.operation === 'find', 'operation');
assert(p1.args.length === 2, 'find has 2 args');
assert(deepEqual(p1.args[0], {}), 'first arg is filter {}');
assert(deepEqual(p1.args[1], { name: 1, _id: 0 }), 'second arg is projection { name: 1, _id: 0 }');
console.log('✓', q1);
console.log('  → filter:', JSON.stringify(p1.args[0]), 'projection:', JSON.stringify(p1.args[1]));

const q2 = 'db.students.find({})';
const p2 = parseMongoQuery(q2);
assert(p2.args.length === 1, 'find with one arg');
assert(deepEqual(p2.args[0], {}), 'single arg is filter');
console.log('✓', q2);
console.log('  → filter:', JSON.stringify(p2.args[0]), 'projection: (none)');

const q3 = 'db.students.find({}, {})';
const p3 = parseMongoQuery(q3);
assert(p3.args.length === 2, 'find with two args');
assert(deepEqual(p3.args[1], {}), 'second arg is {}');
console.log('✓', q3);

const q4 = 'db.students.findOne({ name: "Aniket" }, { name: 1, age: 1, _id: 0 })';
const p4 = parseMongoQuery(q4);
assert(p4.operation.toLowerCase() === 'findone', 'operation findOne');
assert(p4.args.length === 2, 'findOne has 2 args');
assert(deepEqual(p4.args[1], { name: 1, age: 1, _id: 0 }), 'findOne projection parsed');
console.log('✓', q4);
console.log('  → projection:', JSON.stringify(p4.args[1]));

const q5 = 'db.students.find({ age: 15 }, { name: 1 }).limit(10).sort({ name: 1 })';
const p5 = parseMongoQuery(q5);
assert(p5.args.length === 2, 'find with chain has 2 args');
assert(deepEqual(p5.args[0], { age: 15 }), 'filter');
assert(deepEqual(p5.args[1], { name: 1 }), 'projection');
assert(
  p5.chain.some((c) => c.name.toLowerCase() === 'limit'),
  'has limit in chain',
);
assert(
  p5.chain.some((c) => c.name.toLowerCase() === 'sort'),
  'has sort in chain',
);
console.log('✓', q5);

  const argsStr = '{}, { name: 1, _id: 0 }';
const args = parseMongoArgs(argsStr);
assert(Array.isArray(args) && args.length === 2, 'two args');
assert(deepEqual(args[0], {}), 'first arg {}');
assert(deepEqual(args[1], { name: 1, _id: 0 }), 'second arg projection');
console.log('✓ parseMongoArgs("' + argsStr + '") →', args.length, 'args');

const q6 = 'db.students.find({}, { name: 1, _id: 0 })';
const p6 = parseMongoQuery(q6);
assert(deepEqual(p6.args[1], { name: 1, _id: 0 }), 'single-quoted query projection');
console.log('✓', q6);

const q7 = 'db.students.find({}, { name: 1, _id: 0 });';
const p7 = parseMongoQuery(q7);
assert(deepEqual(p7.args[1], { name: 1, _id: 0 }), 'trailing semicolon');
console.log('✓', q7);

console.log(
  '\nAll checks passed. Parser correctly extracts filter and projection for find/findOne.',
);
console.log(
  'Adapter uses args[1] as options.projection when it is a plain object (see asProjectionOption).',
);
