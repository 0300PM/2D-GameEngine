export declare const resolveTable: (table?: string) => string;
export declare const schemaStatements: (dialect: "postgres" | "mysql", table?: string) => string[];
export declare const selectStatement: (dialect: "postgres" | "mysql", table?: string) => string;
export declare const upsertStatement: (dialect: "postgres" | "mysql", table?: string) => string;
export declare const deleteStatement: (dialect: "postgres" | "mysql", table?: string) => string;
export declare const keysStatement: (dialect: "postgres" | "mysql", table?: string) => string;
export declare const clearStatement: (dialect: "postgres" | "mysql", table?: string) => string;
