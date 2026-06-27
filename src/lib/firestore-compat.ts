/**
 * A lightweight Firestore compatibility layer for Supabase.
 *
 * This module enables the existing app code to continue using Firestore-style
 * references and queries while translating them to Supabase table operations.
 */

import type { SupabaseClient, PostgrestFilterBuilder } from '@supabase/supabase-js';
import { db as defaultDb } from '@/lib/firebase';

export type DocumentData = any;

type FirestoreCollectionRef = {
  type: 'collection';
  path: string[];
};

type FirestoreDocRef = {
  type: 'doc';
  path: string[];
  id: string;
};

type FirestoreQueryConstraint =
  | ReturnType<typeof where>
  | ReturnType<typeof orderBy>
  | ReturnType<typeof limit>;

type FirestoreQueryRef = {
  type: 'query';
  collection: FirestoreCollectionRef;
  constraints: FirestoreQueryConstraint[];
};

type FirestoreQuerySnapshot = {
  docs: QueryDocumentSnapshot[];
  forEach(callback: (doc: QueryDocumentSnapshot) => void): void;
};

type QueryDocumentSnapshot = {
  id: string;
  exists: boolean;
  data(): DocumentData;
};

type FirestoreDocumentSnapshot = {
  id: string;
  exists: boolean;
  data(): DocumentData;
};

type WhereClause = {
  field: string;
  op: string;
  value: any;
};

type OrderByClause = {
  field: string;
  direction?: 'asc' | 'desc';
};

type LimitClause = {
  value: number;
};

function toSnakeCase(value: string): string {
  if (value === '__name__') return 'id';
  return value
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]/g, '_')
    .toLowerCase();
}

function toTableName(value: string): string {
  if (value === 'users') return 'app_users';
  return toSnakeCase(value);
}

function isSupabaseClient(value: any): value is SupabaseClient {
  return value && typeof value.from === 'function';
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());
}

function snakeifyObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeifyObject);
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj !== 'object') return obj;

  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[toSnakeCase(key)] = snakeifyObject(value);
    return acc;
  }, {} as Record<string, any>);
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value);
}

function toFirestoreTimestamp(date: Date) {
  return {
    toDate: () => date,
  };
}

function camelizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelizeObject);
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && isIsoDateString(obj)) {
      return toFirestoreTimestamp(new Date(obj));
    }
    return obj;
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    const camelKey = toCamelCase(key);
    const convertedValue = camelizeObject(value);
    if (
      typeof convertedValue === 'string' &&
      (camelKey.toLowerCase().endsWith('at') || camelKey.toLowerCase().endsWith('date') || camelKey.toLowerCase().includes('birth')) &&
      isIsoDateString(convertedValue)
    ) {
      acc[camelKey] = toFirestoreTimestamp(new Date(convertedValue));
    } else {
      acc[camelKey] = convertedValue;
    }
    return acc;
  }, {} as Record<string, any>);
}

function parsePath(path: string[]): {
  collection: string;
  docId?: string;
  parentFilters: WhereClause[];
} {
  const normalized = path.flatMap((segment) => String(segment).split('/').filter(Boolean));

  if (normalized.length === 0) {
    throw new Error('Invalid path: empty path is not supported');
  }

  const parentFilters: WhereClause[] = [];
  let collection = normalized[normalized.length - 1];
  let docId: string | undefined;

  if (normalized.length % 2 === 0) {
    // Even path length means final item is a document ID.
    docId = normalized[normalized.length - 1];
    collection = normalized[normalized.length - 2];
  }

  const parentSegments = docId ? normalized.slice(0, -2) : normalized.slice(0, -1);
  for (let i = 0; i < parentSegments.length; i += 2) {
    const parentCollection = parentSegments[i];
    const parentId = parentSegments[i + 1];
    if (!parentCollection || !parentId) continue;
    const field = `${toSnakeCase(parentCollection.endsWith('s') ? parentCollection.slice(0, -1) : parentCollection)}_id`;
    parentFilters.push({ field, op: '==', value: parentId });
  }

  return { collection, docId, parentFilters };
}

type AnyPostgrestFilterBuilder = PostgrestFilterBuilder<any, any, any, any>;

function buildFilter(query: AnyPostgrestFilterBuilder, clause: WhereClause): AnyPostgrestFilterBuilder {
  const field = toSnakeCase(clause.field === '__name__' ? 'id' : clause.field);
  switch (clause.op) {
    case '==':
      return query.eq(field, clause.value);
    case '!=':
      return query.neq(field, clause.value);
    case '<':
      return query.lt(field, clause.value);
    case '<=':
      return query.lte(field, clause.value);
    case '>':
      return query.gt(field, clause.value);
    case '>=':
      return query.gte(field, clause.value);
    case 'in':
      return query.in(field, clause.value);
    case 'not-in':
      return query.not(field, 'in', clause.value);
    case 'array-contains':
      return query.contains(field, [clause.value]);
    case 'array-contains-any':
      return query.overlaps(field, clause.value);
    default:
      throw new Error(`Unsupported query operator: ${clause.op}`);
  }
}

function buildQuery(db: SupabaseClient, collectionRef: FirestoreCollectionRef, constraints: FirestoreQueryConstraint[]) {
  const { collection, parentFilters } = parsePath(collectionRef.path);
  let query = db.from(toTableName(collection)).select('*');

  parentFilters.forEach((filter) => {
    query = buildFilter(query, filter);
  });

  constraints.forEach((constraint) => {
    if (constraint.type === 'where') {
      query = buildFilter(query, constraint);
      return;
    }
    if (constraint.type === 'orderBy') {
      query = query.order(toSnakeCase(constraint.field), { ascending: constraint.direction !== 'desc' });
      return;
    }
    if (constraint.type === 'limit') {
      query = query.limit(constraint.value);
      return;
    }
  });

  return query;
}

function wrapDocument(doc: any): QueryDocumentSnapshot {
  return {
    id: doc.id,
    exists: true,
    data: () => camelizeObject(doc),
  };
}

function wrapDocumentSnapshot(doc: any): FirestoreDocumentSnapshot {
  return {
    id: doc?.id ?? '',
    exists: !!doc,
    data: () => camelizeObject(doc),
  };
}

export function collection(db: SupabaseClient, ...path: string[]): FirestoreCollectionRef {
  return {
    type: 'collection',
    path,
  };
}

export function doc(collectionRef: FirestoreCollectionRef): FirestoreDocRef;
export function doc(collectionRef: FirestoreCollectionRef, id: string): FirestoreDocRef;
export function doc(db: SupabaseClient, collectionRef: FirestoreCollectionRef): FirestoreDocRef;
export function doc(db: SupabaseClient, collectionRef: FirestoreCollectionRef, id: string): FirestoreDocRef;
export function doc(db: SupabaseClient, ...path: string[]): FirestoreDocRef;
export function doc(...args: any[]): FirestoreDocRef {
  let collectionRef: FirestoreCollectionRef;
  let id: string;

  if (args[0]?.type === 'collection') {
    collectionRef = args[0] as FirestoreCollectionRef;
    id = args[1] !== undefined ? String(args[1]) : crypto.randomUUID();
  } else if (args[0] && typeof args[0].from === 'function') {
    const path = args.slice(1);
    if (path[0]?.type === 'collection') {
      collectionRef = path[0] as FirestoreCollectionRef;
      id = path[1] !== undefined ? String(path[1]) : crypto.randomUUID();
    } else {
      const segments = path.map(String);
      id = segments.pop() ?? crypto.randomUUID();
      collectionRef = { type: 'collection', path: segments };
    }
  } else {
    const path = args.map(String);
    id = path.pop() ?? crypto.randomUUID();
    collectionRef = { type: 'collection', path };
  }

  return {
    type: 'doc',
    path: [...collectionRef.path, id],
    id,
  };
}

export function query(collectionRef: FirestoreCollectionRef, ...constraints: FirestoreQueryConstraint[]): FirestoreQueryRef {
  return {
    type: 'query',
    collection: collectionRef,
    constraints,
  };
}

export function where(field: string, op: string, value: any) {
  return {
    type: 'where',
    field,
    op,
    value,
  } as const;
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return {
    type: 'orderBy',
    field,
    direction,
  } as const;
}

export function limit(value: number) {
  return {
    type: 'limit',
    value,
  } as const;
}

export async function getDoc(docRef: FirestoreDocRef): Promise<FirestoreDocumentSnapshot>;
export async function getDoc(db: SupabaseClient, docRef: FirestoreDocRef): Promise<FirestoreDocumentSnapshot>;
export async function getDoc(dbOrDocRef: SupabaseClient | FirestoreDocRef, maybeDocRef?: FirestoreDocRef): Promise<FirestoreDocumentSnapshot> {
  const db = isSupabaseClient(dbOrDocRef) ? dbOrDocRef : defaultDb;
  const docRef = isSupabaseClient(dbOrDocRef) ? maybeDocRef! : dbOrDocRef;

  const { collection, docId, parentFilters } = parsePath(docRef.path);
  let query = db.from(toTableName(collection)).select('*').eq('id', String(docId));
  parentFilters.forEach((filter) => {
    query = buildFilter(query, filter);
  });

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to get document: ${error.message}`);
  }

  return wrapDocumentSnapshot(data);
}

export async function getDocs(queryRef: FirestoreQueryRef): Promise<FirestoreQuerySnapshot>;
export async function getDocs(db: SupabaseClient, queryRef: FirestoreQueryRef): Promise<FirestoreQuerySnapshot>;
export async function getDocs(dbOrQueryRef: SupabaseClient | FirestoreQueryRef, maybeQueryRef?: FirestoreQueryRef): Promise<FirestoreQuerySnapshot> {
  const db = isSupabaseClient(dbOrQueryRef) ? dbOrQueryRef : defaultDb;
  const queryRef = isSupabaseClient(dbOrQueryRef) ? maybeQueryRef! : dbOrQueryRef;

  const { data, error } = await buildQuery(db, queryRef.collection, queryRef.constraints);
  if (error) {
    throw new Error(`Failed to get documents: ${error.message}`);
  }

  const docs = Array.isArray(data) ? data.map(wrapDocument) : [];
  return {
    docs,
    forEach(callback: (doc: QueryDocumentSnapshot) => void) {
      docs.forEach(callback);
    },
  };
}

export async function setDoc(docRef: FirestoreDocRef, data: any, options?: { merge?: boolean }): Promise<void>;
export async function setDoc(db: SupabaseClient, docRef: FirestoreDocRef, data: any, options?: { merge?: boolean }): Promise<void>;
export async function setDoc(dbOrDocRef: SupabaseClient | FirestoreDocRef, docRefOrData: FirestoreDocRef | any, dataOrOptions?: any, maybeOptions?: { merge?: boolean }): Promise<void> {
  const db = isSupabaseClient(dbOrDocRef) ? dbOrDocRef : defaultDb;
  const docRef = isSupabaseClient(dbOrDocRef) ? docRefOrData as FirestoreDocRef : dbOrDocRef;
  const data = isSupabaseClient(dbOrDocRef) ? dataOrOptions : docRefOrData;
  const options = isSupabaseClient(dbOrDocRef) ? maybeOptions : dataOrOptions;

  const { collection, docId } = parsePath(docRef.path);
  const payload = { id: String(docId), ...snakeifyObject(data) };

  let upsertData = payload;
  if (docRef.path.length > 2) {
    const { parentFilters } = parsePath(docRef.path);
    parentFilters.forEach((filter) => {
      upsertData[filter.field] = filter.value;
    });
  }

  const { error } = await db.from(toTableName(collection)).upsert(upsertData, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(`Failed to set document: ${error.message}`);
  }
}

export async function updateDoc(docRef: FirestoreDocRef, data: any): Promise<void>;
export async function updateDoc(db: SupabaseClient, docRef: FirestoreDocRef, data: any): Promise<void>;
export async function updateDoc(dbOrDocRef: SupabaseClient | FirestoreDocRef, docRefOrData: FirestoreDocRef | any, maybeData?: any): Promise<void> {
  const db = isSupabaseClient(dbOrDocRef) ? dbOrDocRef : defaultDb;
  const docRef = isSupabaseClient(dbOrDocRef) ? docRefOrData as FirestoreDocRef : dbOrDocRef;
  const data = isSupabaseClient(dbOrDocRef) ? maybeData : docRefOrData;

  const { collection, docId, parentFilters } = parsePath(docRef.path);
  const payload = snakeifyObject(data);
  let query = db.from(toTableName(collection)).update(payload).eq('id', String(docId));

  parentFilters.forEach((filter) => {
    query = buildFilter(query, filter);
  });

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to update document: ${error.message}`);
  }
}

export async function deleteDoc(docRef: FirestoreDocRef): Promise<void>;
export async function deleteDoc(db: SupabaseClient, docRef: FirestoreDocRef): Promise<void>;
export async function deleteDoc(dbOrDocRef: SupabaseClient | FirestoreDocRef, maybeDocRef?: FirestoreDocRef): Promise<void> {
  const db = isSupabaseClient(dbOrDocRef) ? dbOrDocRef : defaultDb;
  const docRef = isSupabaseClient(dbOrDocRef) ? maybeDocRef! : dbOrDocRef;

  const { collection, docId, parentFilters } = parsePath(docRef.path);
  let query = db.from(toTableName(collection)).delete().eq('id', String(docId));

  parentFilters.forEach((filter) => {
    query = buildFilter(query, filter);
  });

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

export async function addDoc(collectionRef: FirestoreCollectionRef, data: any): Promise<FirestoreDocRef>;
export async function addDoc(db: SupabaseClient, collectionRef: FirestoreCollectionRef, data: any): Promise<FirestoreDocRef>;
export async function addDoc(dbOrCollectionRef: SupabaseClient | FirestoreCollectionRef, collectionRefOrData: FirestoreCollectionRef | any, maybeData?: any): Promise<FirestoreDocRef> {
  const db = isSupabaseClient(dbOrCollectionRef) ? dbOrCollectionRef : defaultDb;
  const collectionRef = isSupabaseClient(dbOrCollectionRef) ? collectionRefOrData as FirestoreCollectionRef : dbOrCollectionRef;
  const data = isSupabaseClient(dbOrCollectionRef) ? maybeData : collectionRefOrData;

  const id = crypto.randomUUID();
  const docRef = doc(db, collectionRef, id);
  await setDoc(db, docRef, data);
  return docRef;
}

export function serverTimestamp() {
  return new Date();
}

export function writeBatch(db: SupabaseClient) {
  const operations: Array<() => Promise<void>> = [];

  return {
    set(docRef: FirestoreDocRef, data: any) {
      operations.push(() => setDoc(db, docRef, data));
    },
    update(docRef: FirestoreDocRef, data: any) {
      operations.push(() => updateDoc(db, docRef, data));
    },
    async commit() {
      for (const operation of operations) {
        await operation();
      }
    },
  };
}

function buildSnapshot(doc: any): QueryDocumentSnapshot {
  return {
    id: doc?.id ?? '',
    exists: !!doc,
    data: () => camelizeObject(doc),
  };
}

export function onSnapshot(refOrQuery: FirestoreDocRef | FirestoreQueryRef, callback: (snapshot: any) => void, errorCallback?: (error: Error) => void): () => void;
export function onSnapshot(db: SupabaseClient, refOrQuery: FirestoreDocRef | FirestoreQueryRef, callback: (snapshot: any) => void, errorCallback?: (error: Error) => void): () => void;
export function onSnapshot(dbOrRef: SupabaseClient | FirestoreDocRef | FirestoreQueryRef, refOrMaybeCallback?: FirestoreDocRef | FirestoreQueryRef | ((snapshot: any) => void), callbackMaybe?: (snapshot: any) => void, errorCallback?: (error: Error) => void) {
  const db = isSupabaseClient(dbOrRef) ? dbOrRef : defaultDb;
  const refOrQuery = isSupabaseClient(dbOrRef) ? refOrMaybeCallback as FirestoreDocRef | FirestoreQueryRef : dbOrRef;
  const callback = isSupabaseClient(dbOrRef) ? callbackMaybe! : refOrMaybeCallback as (snapshot: any) => void;
  const errorCb = isSupabaseClient(dbOrRef) ? errorCallback : callbackMaybe as (error: Error) => void | undefined;
  
  const isDoc = refOrQuery.type === 'doc';

  const execute = async () => {
    try {
      if (isDoc) {
        const snapshot = await getDoc(db, refOrQuery as FirestoreDocRef);
        callback(snapshot);
      } else {
        const snapshot = await getDocs(db, refOrQuery as FirestoreQueryRef);
        callback(snapshot);
      }
    } catch (error: any) {
      errorCb?.(error);
    }
  };

  execute();

  const { collection } = isDoc ? parsePath((refOrQuery as FirestoreDocRef).path) : parsePath((refOrQuery as FirestoreQueryRef).collection.path);
  const channel = db
    .channel(`supabase-firestore-compat:${collection}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: toSnakeCase(collection) }, () => {
      execute();
    })
    .subscribe();

  return () => {
    db.removeChannel(channel);
  };
}
