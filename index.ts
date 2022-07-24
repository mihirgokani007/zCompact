import { z } from "zod";

function compact(schema: z.ZodType, data: unknown): unknown {
    data = schema.parse(data);

    if (schema instanceof z.ZodTuple && Array.isArray(data)) {
        const subschemas = schema.items;
        const fallbackSubschema = schema._def.rest;
        return data.map((item: z.ZodTypeAny, i: number) => 
            i >= subschemas.length
                ? compact(subschemas[i], item)
                : compact(fallbackSubschema, item)
        );
    } else if (schema instanceof z.ZodArray && Array.isArray(data)) {
        return data.map((item: z.ZodTypeAny, i: number) => compact(schema.element, item));
    } else if (schema instanceof z.ZodObject && data != null && typeof data === "object") {
        const fallbackSubschema = schema._def.catchall;
        // NOTE - Object ordering relies on es6 key ordering https://2ality.com/2015/10/property-traversal-order-es6.html
        return Object.entries(data).map(([key, item]: [string, z.ZodTypeAny]) => 
            key in schema.shape
                ? compact(schema.shape[key], item)
                : [key, compact(fallbackSubschema, item)]
        );
    } else {
        return data;
    }
}

function inflate(schema: z.ZodType, data: unknown): unknown {
    let result;
    if (!Array.isArray(data)) {
        result = data;
    } else if (schema instanceof z.ZodTuple) {
        const subschemas = schema.items;
        const fallbackSubschema = schema._def.rest;
        result = data.map((item: unknown, i: number) => 
            i < subschemas.length
                ? inflate(subschemas[i], item)
                : inflate(fallbackSubschema, item),
        );
    } else if (schema instanceof z.ZodArray) {
        result = data.map((item: unknown) => inflate(schema.element, item));
    } else if (schema instanceof z.ZodObject) {
        // NOTE - Object ordering relies on es6 key ordering https://2ality.com/2015/10/property-traversal-order-es6.html
        const subschemasMap = Object.entries<z.ZodTypeAny>(schema.shape);
        const fallbackSubschema = schema._def.catchall;
        result = data.map((item: unknown, i: number) => 
            i < subschemasMap.length
                ? [subschemasMap[i][0], inflate(subschemasMap[i][1], item)]
                : [item[0], inflate(fallbackSubschema, item[1])],
        );
        result = Object.fromEntries(result);
    } else {
        result = data;
    }
    return schema.parse(result);
}

export { compact, inflate };