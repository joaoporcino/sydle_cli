/**
 * Global definitions for Sydle Platform scripts.
 */

declare interface Sys {
    /**
     * Gets a record by ID.
     */
    get(classId: string, id: string): any;

    /**
     * Searches for records.
     */
    search(classId: string, query: any): any[];

    /**
     * Posts data to a Sydle endpoint.
     */
    post(url: string, data: any): any;

    /**
     * Logs a message to the Sydle console.
     */
    log(message: string): void;
}

declare interface Main {
    /**
     * Executes a method on a class.
     */
    execute(classId: string, method: string, data?: any): any;
}

declare interface I_ElasticSearchResult<T = any> {
    took: number;
    timed_out: boolean;
    _shards: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
    hits: {
        total: {
            value: number;
            relation: string;
        };
        max_score: number | null;
        hits: Array<{
            _index: string;
            _type: string;
            _id: string;
            _score: number;
            _source: T;
        }>;
    };
}

declare const sys: Sys;
declare const main: Main;
declare const context: {
    user: any;
    params: any;
};

declare var _input: any;
declare var _output: any;
