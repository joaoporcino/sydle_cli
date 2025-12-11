const client = require('./client');

const executeMainMethod = async (id, method, data = {}, httpMethod = 'POST') => {
    try {
        const url = `/main/_classId/${id}/${method}`;
        const config = {
            method: httpMethod,
            url: url,
            data: data
        };

        // If it's a GET request, we might want to pass data as params, but usually GET doesn't have a body.
        // For now, let's assume if it's GET, data is params.
        if (httpMethod.toUpperCase() === 'GET') {
            config.params = data;
            delete config.data;
        }
        // console.log(config)
        const response = await client(config);
        return response.data;
    } catch (error) {
        console.error(`Error executing ${method} on ${id}:`, error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
};

const searchPaginated = async (classId, query, pageSize, onBatch) => {
    let searchAfter = null;
    let hasMore = true;

    // Ensure sort is present for search_after to work reliably
    if (!query.sort) {
        query.sort = [{ "_id": "asc" }];
    }

    // Ensure size is set
    query.size = pageSize;

    while (hasMore) {
        if (searchAfter) {
            query.search_after = searchAfter;
        }

        const response = await executeMainMethod(classId, '_search', query, 'POST');

        if (response && response.hits && response.hits.hits && response.hits.hits.length > 0) {
            const hits = response.hits.hits;
            await onBatch(hits);

            // Update search_after with the sort values of the last hit
            const lastHit = hits[hits.length - 1];
            if (lastHit.sort) {
                searchAfter = lastHit.sort;
            } else {
                // Fallback if no sort values returned (shouldn't happen if sort is in query)
                hasMore = false;
            }

            if (hits.length < pageSize) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
};

const get = async (classId, id) => {
    return await executeMainMethod(classId, "_get", { _id: id }, 'POST');
};

module.exports = { executeMainMethod, searchPaginated, get };
