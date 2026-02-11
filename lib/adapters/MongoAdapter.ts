import {
  MongoClient,
  Document,
  Binary,
  BSONRegExp,
  Timestamp,
  Decimal128,
  MinKey,
  MaxKey,
  Long,
  ClientSession,
  ObjectId,
} from 'mongodb';
import { logger } from '../logger';
import type {
  DatabaseAdapter,
  QueryResult,
  TableInfo,
  ColumnSchema,
  ColumnInfo,
  QueryOptions,
} from '../types';
import {
  DEFAULT_QUERY_LIMIT,
  DEFAULT_QUERY_TIMEOUT_MS,
  MONGO_SCHEMA_SAMPLE_SIZE,
} from '../queryConfig';
import { parseMongoQuery, normalizeMongoDoc } from './mongoParser';
import { loadDefaultDatabases } from '../config/databaseConfig';

/**
 * Each session gets its own MongoClient. The driver pools connections internally per client.
 * For very high concurrency to the same URL, consider a shared client pool keyed by URL.
 */
export class MongoAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private transactionSession: ClientSession | null = null;
  private connectionUrl: string | null = null;
  private isDefaultConfig: boolean = false;

  async connect(connectionUrl: string): Promise<void> {
    this.connectionUrl = connectionUrl;
    const defaults = loadDefaultDatabases();
    this.isDefaultConfig = defaults.some((db) => db.type === 'mongodb' && db.url === connectionUrl);
    this.client = new MongoClient(connectionUrl);
    await this.client.connect();
    this.startHealthCheck();
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    if (this.transactionSession) {
      try {
        await this.transactionSession.abortTransaction();
      } finally {
        this.transactionSession.endSession();
        this.transactionSession = null;
      }
    }
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.connectionUrl = null;
    this.isDefaultConfig = false;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  private simulateDestructiveOperation(operation: string, details?: string): QueryResult {
    const message = `Query executed successfully (simulated). Your query syntax is correct, but destructive operations like ${operation} are only allowed when connecting to your own database. Use your own MongoDB connection URL to perform this operation.`;
    return {
      rows: [
        {
          acknowledged: true,
          simulated: true,
          message,
          operation,
          ...(details ? { details } : {}),
        },
      ] as Record<string, unknown>[],
      columns: [
        { name: 'acknowledged', type: 'boolean' },
        { name: 'simulated', type: 'boolean' },
        { name: 'message', type: 'string' },
        { name: 'operation', type: 'string' },
        ...(details ? [{ name: 'details', type: 'string' }] : []),
      ],
      rowCount: 1,
      executionTime: 0,
    };
  }

  async executeQuery(
    query: string,
    database?: string,
    options?: QueryOptions,
  ): Promise<QueryResult> {
    if (!this.client) throw new Error('Not connected');

    const startTime = Date.now();
    const parsed = parseMongoQuery(query);
    const effectiveDb = parsed.database || database;
    const db = this.client.db(effectiveDb || undefined);
    const timeoutMs = DEFAULT_QUERY_TIMEOUT_MS;
    const session = this.transactionSession ?? undefined;

    let result: Document[] = [];
    let rowCount = 0;
    let simulatedMessage: string | undefined;

    switch (parsed.target) {
      case 'admin': {
        const admin = db.admin();
        switch (parsed.operation.toLowerCase()) {
          case 'listdatabases': {
            const listResult = await this.withTimeout(admin.listDatabases(), timeoutMs);
            result = listResult.databases as unknown as Document[];
            rowCount = result.length;
            break;
          }
          case 'stats': {
            const stats = await this.withTimeout(admin.serverStatus(), timeoutMs);
            result = [stats as unknown as Document];
            rowCount = 1;
            break;
          }
          default:
            throw new Error(`Unsupported admin operation: ${parsed.operation}`);
        }
        break;
      }
      case 'db': {
        switch (parsed.operation.toLowerCase()) {
          case 'use': {
            const dbName = parsed.args[0] ? String(parsed.args[0]) : '';
            result = [
              {
                switchedToDb: dbName,
                message: `Switched to db ${dbName}`,
              },
            ] as unknown as Document[];
            rowCount = 1;
            break;
          }
          case 'stats': {
            const stats = await this.withTimeout(db.stats(), timeoutMs);
            result = [stats as unknown as Document];
            rowCount = 1;
            break;
          }
          case 'listdatabases': {
            const listResult = await this.withTimeout(db.admin().listDatabases(), timeoutMs);
            result = listResult.databases as unknown as Document[];
            rowCount = result.length;
            break;
          }
          case 'dropdatabase': {
            if (this.isDefaultConfig && !options?.allowDestructive) {
              const simResult = this.simulateDestructiveOperation(
                'dropDatabase',
                `Database "${effectiveDb || 'current'}" would be dropped`,
              );
              return simResult;
            }
            const dropped = await this.withTimeout(db.dropDatabase(), timeoutMs);
            result = [{ dropped }] as unknown as Document[];
            rowCount = 1;
            break;
          }
          case 'dropcollection': {
            const target = parsed.args[0] ? String(parsed.args[0]) : '';
            if (!target) {
              throw new Error('Missing collection name for dropCollection');
            }
            if (this.isDefaultConfig && !options?.allowDestructive) {
              const simResult = this.simulateDestructiveOperation(
                'dropCollection',
                `Collection "${target}" would be dropped`,
              );
              return simResult;
            }
            const dropped = await this.withTimeout(db.dropCollection(target), timeoutMs);
            result = [{ dropped }] as unknown as Document[];
            rowCount = 1;
            break;
          }
          case 'createcollection': {
            const collectionName = parsed.args[0] ? String(parsed.args[0]) : '';
            if (!collectionName) {
              throw new Error(
                'Missing collection name. Usage: db.createCollection("collectionName", {options})',
              );
            }
            const opts = parsed.args[1] ? normalizeMongoDoc(parsed.args[1]) : {};
            try {
              await this.withTimeout(db.createCollection(collectionName, opts), timeoutMs);
              result = [{ created: true, collection: collectionName }] as unknown as Document[];
              rowCount = 1;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (
                errorMessage.includes('already exists') ||
                errorMessage.includes('NamespaceExists')
              ) {
                throw new Error(
                  `Collection "${collectionName}" already exists. Collections are automatically created on first insert, so you may not need to create it explicitly.`,
                );
              }
              throw new Error(`Failed to create collection: ${errorMessage}`);
            }
            break;
          }
          case 'listcollections':
          case 'getcollectionnames': {
            const collections = await this.withTimeout(db.listCollections().toArray(), timeoutMs);
            result = collections.map((c) => ({ name: c.name })) as unknown as Document[];
            rowCount = result.length;
            break;
          }
          default:
            throw new Error(`Unsupported database operation: ${parsed.operation}`);
        }
        break;
      }
      case 'collection': {
        if (!parsed.collection) {
          throw new Error('Missing collection name for MongoDB operation');
        }
        const collectionName = parsed.collection;
        const collection = db.collection(collectionName);

        switch (parsed.operation.toLowerCase()) {
          case 'find': {
            const filter = normalizeMongoDoc(parsed.args[0]);
            const findOptions = normalizeMongoDoc(parsed.args[1]);
            const cursor = collection
              .find(filter, { ...findOptions, session })
              .maxTimeMS(timeoutMs);

            let hasLimit = false;
            let hasSkip = false;
            for (const chain of parsed.chain) {
              const name = chain.name.toLowerCase();
              if (name === 'sort') {
                cursor.sort(normalizeMongoDoc(chain.args[0]));
              } else if (name === 'limit') {
                cursor.limit(Number(chain.args[0]));
                hasLimit = true;
              } else if (name === 'skip') {
                cursor.skip(Number(chain.args[0]));
                hasSkip = true;
              } else if (name === 'project') {
                cursor.project(normalizeMongoDoc(chain.args[0]));
              } else {
                throw new Error(`Unsupported cursor method: ${chain.name}`);
              }
            }

            if (typeof findOptions.limit === 'number' && !hasLimit) {
              cursor.limit(findOptions.limit);
              hasLimit = true;
            }
            if (typeof findOptions.skip === 'number' && !hasSkip) {
              cursor.skip(findOptions.skip);
              hasSkip = true;
            }

            if (!hasLimit) {
              const limit = options?.limit ?? DEFAULT_QUERY_LIMIT;
              cursor.limit(limit);
            }
            if (!hasSkip && typeof options?.offset === 'number' && options.offset > 0) {
              cursor.skip(options.offset);
            }

            // If explain mode, return execution stats instead of results
            if (options?.explain) {
              const explainResult = await this.withTimeout(
                cursor.explain('executionStats'),
                timeoutMs,
              );
              result = [explainResult as unknown as Document];
              rowCount = 1;
            } else {
              result = await this.withTimeout(cursor.toArray(), timeoutMs);
              rowCount = result.length;
            }
            break;
          }

          case 'drop': {
            if (this.isDefaultConfig && !options?.allowDestructive) {
              const simResult = this.simulateDestructiveOperation(
                'drop',
                `Collection "${collectionName}" would be dropped`,
              );
              return simResult;
            }
            const dropped = await this.withTimeout(collection.drop({ session }), timeoutMs);
            result = [{ dropped }] as unknown as Document[];
            rowCount = 1;
            break;
          }

          case 'findone': {
            const filter = normalizeMongoDoc(parsed.args[0]);
            const doc = await this.withTimeout(
              collection.findOne(filter, { maxTimeMS: timeoutMs, session }),
              timeoutMs,
            );
            result = doc ? [doc] : [];
            rowCount = result.length;
            break;
          }

          case 'aggregate': {
            const pipeline = (parsed.args[0] as Document[]) || [];
            const cursor = collection.aggregate(pipeline, { maxTimeMS: timeoutMs, session });
            let hasLimit = false;
            let hasSkip = false;

            for (const chain of parsed.chain) {
              const name = chain.name.toLowerCase();
              if (name === 'sort') {
                cursor.sort(normalizeMongoDoc(chain.args[0]));
              } else if (name === 'limit') {
                cursor.limit(Number(chain.args[0]));
                hasLimit = true;
              } else if (name === 'skip') {
                cursor.skip(Number(chain.args[0]));
                hasSkip = true;
              } else {
                throw new Error(`Unsupported aggregation cursor method: ${chain.name}`);
              }
            }

            if (!hasLimit) {
              const limit = options?.limit ?? DEFAULT_QUERY_LIMIT;
              cursor.limit(limit);
            }
            if (!hasSkip && typeof options?.offset === 'number' && options.offset > 0) {
              cursor.skip(options.offset);
            }

            // If explain mode, return execution stats instead of results
            if (options?.explain) {
              const explainResult = await this.withTimeout(
                cursor.explain('executionStats'),
                timeoutMs,
              );
              result = [explainResult as unknown as Document];
              rowCount = 1;
            } else {
              result = await this.withTimeout(cursor.toArray(), timeoutMs);
              rowCount = result.length;
            }
            break;
          }

          case 'countdocuments':
          case 'count': {
            const filter = normalizeMongoDoc(parsed.args[0]);
            const count = await this.withTimeout(
              collection.countDocuments(filter, { maxTimeMS: timeoutMs, session }),
              timeoutMs,
            );
            result = [{ count }];
            rowCount = 1;
            break;
          }

          case 'insertone': {
            const doc = normalizeMongoDoc(parsed.args[0]);
            const insertResult = await this.withTimeout(
              collection.insertOne(doc, { session }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: insertResult.acknowledged,
                insertedId: insertResult.insertedId.toString(),
              },
            ];
            rowCount = 1;
            break;
          }

          case 'insertmany': {
            const docs = (parsed.args[0] as Document[]) || [];
            const insertResult = await this.withTimeout(
              collection.insertMany(docs, { session }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: insertResult.acknowledged,
                insertedCount: insertResult.insertedCount,
                insertedIds: Object.values(insertResult.insertedIds).map((id) => id.toString()),
              },
            ];
            rowCount = 1;
            break;
          }

          case 'updateone': {
            const filter = normalizeMongoDoc(parsed.args[0]);
            const update = normalizeMongoDoc(parsed.args[1]);
            const updateOptions = normalizeMongoDoc(parsed.args[2]);
            const updateResult = await this.withTimeout(
              collection.updateOne(filter, update, { ...updateOptions, session }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: updateResult.acknowledged,
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount,
              },
            ];
            rowCount = 1;
            break;
          }

          case 'updatemany': {
            const filter = normalizeMongoDoc(parsed.args[0]);
            const update = normalizeMongoDoc(parsed.args[1]);
            const updateOptions = normalizeMongoDoc(parsed.args[2]);
            const updateResult = await this.withTimeout(
              collection.updateMany(filter, update, { ...updateOptions, session }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: updateResult.acknowledged,
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount,
              },
            ];
            rowCount = 1;
            break;
          }

          case 'deleteone': {
            if (this.isDefaultConfig && !options?.allowDestructive) {
              const simResult = this.simulateDestructiveOperation(
                'deleteOne',
                `One document matching the filter would be deleted`,
              );
              return simResult;
            }
            const filter = normalizeMongoDoc(parsed.args[0]);
            const deleteResult = await this.withTimeout(
              collection.deleteOne(filter, { session }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: deleteResult.acknowledged,
                deletedCount: deleteResult.deletedCount,
              },
            ];
            rowCount = 1;
            break;
          }

          case 'deletemany': {
            if (this.isDefaultConfig && !options?.allowDestructive) {
              const simResult = this.simulateDestructiveOperation(
                'deleteMany',
                `All documents matching the filter would be deleted`,
              );
              return simResult;
            }
            const filter = normalizeMongoDoc(parsed.args[0]);
            const deleteResult = await this.withTimeout(
              collection.deleteMany(filter, { session }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: deleteResult.acknowledged,
                deletedCount: deleteResult.deletedCount,
              },
            ];
            rowCount = 1;
            break;
          }

          case 'replaceone': {
            const filter = normalizeMongoDoc(parsed.args[0]);
            const replacement = normalizeMongoDoc(parsed.args[1]);
            const replaceOptions = normalizeMongoDoc(parsed.args[2]);
            const replaceResult = await this.withTimeout(
              collection.replaceOne(filter, replacement, { ...replaceOptions, session }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: replaceResult.acknowledged,
                matchedCount: replaceResult.matchedCount,
                modifiedCount: replaceResult.modifiedCount,
                upsertedId: replaceResult.upsertedId?.toString() ?? null,
              },
            ];
            rowCount = 1;
            break;
          }

          case 'bulkwrite': {
            const ops = (parsed.args[0] as Document[]) || [];
            const bulkOptions = normalizeMongoDoc(parsed.args[1]);
            const bulkResult = await this.withTimeout(
              collection.bulkWrite(ops as unknown as Parameters<typeof collection.bulkWrite>[0], {
                ...bulkOptions,
                session,
              }),
              timeoutMs,
            );
            result = [
              {
                acknowledged: bulkResult.isOk(),
                insertedCount: bulkResult.insertedCount,
                matchedCount: bulkResult.matchedCount,
                modifiedCount: bulkResult.modifiedCount,
                deletedCount: bulkResult.deletedCount,
                upsertedCount: bulkResult.upsertedCount,
              },
            ];
            rowCount = 1;
            break;
          }

          case 'createindex': {
            const indexSpec = normalizeMongoDoc(parsed.args[0]);
            const indexOptions = parsed.args[1] ? normalizeMongoDoc(parsed.args[1]) : {};
            try {
              const indexName = await this.withTimeout(
                collection.createIndex(indexSpec, { ...indexOptions, session }),
                timeoutMs,
              );
              result = [{ indexName, created: true }];
              rowCount = 1;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const collectionName = parsed.collection || 'collection';
              if (errorMessage.includes('E11000') || errorMessage.includes('duplicate')) {
                throw new Error(
                  `Index already exists. Use db.${collectionName}.getIndexes() to see existing indexes.`,
                );
              }
              if (errorMessage.includes('bad index')) {
                throw new Error(
                  `Invalid index specification. Example: db.${collectionName}.createIndex({ field: 1 }, { unique: true })`,
                );
              }
              throw new Error(`Index creation failed: ${errorMessage}`);
            }
            break;
          }

          case 'listindexes':
          case 'getindexes': {
            const indexes = await this.withTimeout(
              collection.listIndexes({ session }).toArray(),
              timeoutMs,
            );
            result = indexes as unknown as Document[];
            rowCount = result.length;
            break;
          }

          case 'stats': {
            const stats = await this.withTimeout(
              db.command({ collStats: collectionName }, { session }),
              timeoutMs,
            );
            result = [stats as unknown as Document];
            rowCount = 1;
            break;
          }

          case 'distinct': {
            const field = parsed.args[0] ? String(parsed.args[0]) : '';
            if (!field) {
              throw new Error(
                'distinct requires a field name. Usage: db.collection.distinct("fieldName", {filter})',
              );
            }
            const filter = parsed.args[1] ? normalizeMongoDoc(parsed.args[1]) : {};
            const distinctValues = await this.withTimeout(
              collection.distinct(field, filter, { session }),
              timeoutMs,
            );
            result = distinctValues.map((value) => ({ value }));
            rowCount = result.length;
            break;
          }

          case 'dropindex': {
            const indexName = parsed.args[0] ? String(parsed.args[0]) : '';
            if (!indexName) {
              throw new Error(
                'Missing index name. Usage: db.collection.dropIndex("indexName"). Use db.collection.getIndexes() to list indexes.',
              );
            }
            try {
              const dropResult = await this.withTimeout(
                collection.dropIndex(indexName, { session }),
                timeoutMs,
              );
              result = [{ dropped: dropResult }];
              rowCount = 1;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const collectionName = parsed.collection || 'collection';
              if (errorMessage.includes('not found') || errorMessage.includes('index not found')) {
                throw new Error(
                  `Index "${indexName}" not found. Use db.${collectionName}.getIndexes() to see available indexes.`,
                );
              }
              throw new Error(`Failed to drop index: ${errorMessage}`);
            }
            break;
          }

          default:
            throw new Error(`Unsupported operation: ${parsed.operation}`);
        }

        break;
      }
    }

    const columns = this.inferColumns(result);

    const queryResult: QueryResult = {
      rows: result as Record<string, unknown>[],
      columns,
      rowCount,
      executionTime: Date.now() - startTime,
    };

    if (simulatedMessage) {
      (queryResult.rows[0] as Record<string, unknown>).message = simulatedMessage;
    }

    return queryResult;
  }

  private inferColumns(docs: Document[]): ColumnInfo[] {
    if (docs.length === 0) return [];

    const columnSet = new Set<string>();
    docs.forEach((doc) => {
      Object.keys(doc).forEach((key) => columnSet.add(key));
    });

    return Array.from(columnSet).map((name) => ({
      name,
      type: this.inferType(docs.find((d) => d[name] !== undefined)?.[name]),
    }));
  }

  private inferType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof Binary) return 'binary';
    if (value instanceof BSONRegExp) return 'regex';
    if (value instanceof Timestamp) return 'timestamp';
    if (value instanceof Decimal128) return 'decimal128';
    if (value instanceof MinKey) return 'minkey';
    if (value instanceof MaxKey) return 'maxkey';
    if (value instanceof Long) return 'long';
    if (value instanceof ObjectId) return 'objectid';
    if (typeof value === 'object') {
      if ('_bsontype' in (value as object)) {
        return (value as { _bsontype: string })._bsontype.toLowerCase();
      }
      return 'object';
    }
    return typeof value;
  }

  async getDatabases(): Promise<string[]> {
    if (!this.client) throw new Error('Not connected');

    const admin = this.client.db().admin();
    const result = await admin.listDatabases();
    const databases = result.databases
      .map((db) => db.name)
      .filter((name) => !['admin', 'local', 'config'].includes(name));

    return databases.sort();
  }

  async getTables(database: string): Promise<TableInfo[]> {
    if (!this.client) throw new Error('Not connected');

    const db = this.client.db(database);
    const collections = await db.listCollections().toArray();

    return collections
      .map((c) => ({
        name: c.name,
        type: 'collection' as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getColumns(database: string, collection: string): Promise<ColumnSchema[]> {
    if (!this.client) throw new Error('Not connected');

    const db = this.client.db(database);
    const coll = db.collection(collection);

    const samples = await coll.find({}).limit(MONGO_SCHEMA_SAMPLE_SIZE).toArray();

    if (samples.length === 0) {
      return [];
    }

    const fieldTypes = new Map<string, Map<string, number>>();
    const fieldTotals = new Map<string, number>();

    const processDoc = (doc: Document, prefix = '') => {
      Object.entries(doc).forEach(([key, value]) => {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        const type = this.inferType(value);

        if (!fieldTypes.has(fieldName)) {
          fieldTypes.set(fieldName, new Map());
        }
        const counts = fieldTypes.get(fieldName)!;
        counts.set(type, (counts.get(type) ?? 0) + 1);
        fieldTotals.set(fieldName, (fieldTotals.get(fieldName) ?? 0) + 1);

        if (type === 'object' && value && !Array.isArray(value)) {
          processDoc(value as Document, fieldName);
        }
      });
    };

    samples.forEach((doc) => processDoc(doc));

    return Array.from(fieldTypes.entries())
      .map(([name, types]) => {
        const entries = Array.from(types.entries());
        entries.sort((a, b) => b[1] - a[1]);
        const total = fieldTotals.get(name) ?? 0;
        const maxCount = entries[0]?.[1] ?? 0;
        const confidence = total > 0 ? maxCount / total : 0;
        return {
          name,
          type: entries.map(([type]) => type).join(' | '),
          confidence,
          sampleCount: total,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getServerVersion(): Promise<string> {
    if (!this.client) throw new Error('Not connected');

    const admin = this.client.db().admin();
    const info = await admin.serverInfo();
    return `MongoDB ${info.version}`;
  }

  async beginTransaction(): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    if (this.transactionSession) {
      throw new Error('Transaction already active');
    }

    const session = this.client.startSession();
    session.startTransaction();
    this.transactionSession = session;
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionSession) {
      throw new Error('No active transaction');
    }
    try {
      await this.transactionSession.commitTransaction();
    } finally {
      this.transactionSession.endSession();
      this.transactionSession = null;
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionSession) {
      throw new Error('No active transaction');
    }
    try {
      await this.transactionSession.abortTransaction();
    } finally {
      this.transactionSession.endSession();
      this.transactionSession = null;
    }
  }

  isTransactionActive(): boolean {
    return this.transactionSession !== null;
  }

  async cleanupDatabase(database: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const db = this.client.db(database);
    const collections = await db.listCollections().toArray();

    for (const collection of collections) {
      await db
        .collection(collection.name)
        .drop()
        .catch((error) => {
          logger.error('Failed to drop collection', error, {
            collection: collection.name,
            database,
          });
        });
    }

    logger.logDatabaseOperation('cleanup completed', database);
  }

  /** Drops all user databases (skips admin, local, config). */
  async dropAllUserDatabases(): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const names = await this.getDatabases();
    const skip = ['admin', 'local', 'config'];

    for (const name of names) {
      if (skip.includes(name)) continue;
      try {
        await this.client.db(name).dropDatabase();
        logger.logDatabaseOperation('database dropped', name);
      } catch (error) {
        logger.error('Failed to drop database', error, { database: name });
      }
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      if (!this.client) return;
      try {
        await this.client.db().admin().ping();
      } catch (error) {
        logger.error('MongoDB health check failed', error);
        await this.disconnect();
      }
    }, 60_000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`MongoDB query timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }
}
