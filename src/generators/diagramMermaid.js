/**
 * Generator for Mermaid diagrams from BPMN process diagrams
 * Creates a visual representation of the process flow using Mermaid syntax
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Symbol IDs mapping to determine element types
 */
const SYMBOL_TYPES = {
    // Start Events
    '595c20500061000000000001': 'start',         // Simple start
    '595c20500061000000000002': 'start-timer',   // Timer start
    '595c20500061000000000003': 'start-message', // Message start
    '595c20500061000000000004': 'start-signal',  // Signal start

    // End Events
    '595c20500061000000000005': 'end',           // Simple end
    '595c20500061000000000006': 'end-terminate', // Terminate end
    '595c20500061000000000007': 'end-error',     // Error end
    '595c20500061000000000008': 'end-message',   // Message end
    '595c20500061000000000009': 'end-signal',    // Signal end

    // Intermediate Events
    '595c20500061000000000010': 'intermediate',         // Throw intermediate
    '595c20500061000000000011': 'intermediate-timer',   // Timer intermediate
    '595c20500061000000000015': 'intermediate-message', // Message throw
    '595c20500061000000000016': 'intermediate-catch',   // Message catch
    '595c20500061000000000017': 'intermediate-signal',  // Signal catch
    '595c20500061000000000018': 'intermediate-link',    // Link throw

    // Tasks
    '595c20500041000000000001': 'task',          // Generic task
    '595c20500041000000000002': 'user-task',     // User task
    '595c20500041000000000003': 'script-task',   // Script task
    '595c20500041000000000004': 'service-task',  // Service task

    // Subprocesses
    '595c20500051000000000001': 'subprocess',         // Call subprocess
    '595c20500051000000000002': 'embedded-subprocess', // Embedded subprocess

    // Gateways
    '595c20500071000000000002': 'gateway-exclusive', // Exclusive (XOR)
    '595c20500071000000000003': 'gateway-inclusive', // Inclusive (OR)
    '595c20500071000000000004': 'gateway-parallel',  // Parallel (AND)
};

/**
 * Sanitize name for Mermaid node ID (remove special chars)
 */
function sanitizeId(str) {
    if (!str) return 'unknown';
    return str.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Sanitize folder name for file paths
 */
function sanitizeFolderName(name) {
    if (typeof name === 'object' && name !== null) {
        name = name.pt || name.en || Object.values(name)[0];
    }
    if (!name || typeof name !== 'string') return '';

    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Get element type from symbol ID
 */
function getElementType(symbolId) {
    return SYMBOL_TYPES[symbolId] || 'unknown';
}

/**
 * Get FontAwesome icon for element type
 */
function getElementIcon(type, identifier) {
    // Specific overrides based on identifier
    if (identifier === 'event_inicio') return 'fa:fa-circle';
    if (identifier === 'event_final') return 'fa:fa-o';
    if (identifier === 'event_finalTerminal') return 'fa:fa-circle';
    if (identifier === 'event_finalErro') return 'fa:fa-bolt-lightning';

    // Gateways as icons
    if (type === 'gateway-exclusive') return 'fa:fa-times';
    if (type === 'gateway-inclusive') return 'fa:fa-o';
    if (type === 'gateway-parallel') return 'fa:fa-plus';

    const icons = {
        // Tasks
        'user-task': 'fa:fa-user',
        'service-task': 'fa:fa-cogs',
        'script-task': 'fa:fa-file-code-o',
        'task': 'fa:fa-tasks',

        // Events
        'start-timer': 'fa:fa-clock',
        'intermediate-timer': 'fa:fa-clock',
        'start-message': 'fa:fa-envelope',
        'intermediate-message': 'fa:fa-envelope-open',
        'end-message': 'fa:fa-envelope',
        'start-signal': 'fa:fa-caret-up',
        'intermediate-signal': 'fa:fa-caret-up',
        'end-signal': 'fa:fa-caret-up',
        'end-error': 'fa:fa-exclamation-triangle',
        'end-terminate': 'fa:fa-dot-circle',
        'intermediate-link': 'fa:fa-link',

        // Specific reclassifications icons
        'intermediate-envelope': 'fa:fa-envelope',
        'intermediate-caret-left': 'fa:fa-caret-left',
        'intermediate-caret-right': 'fa:fa-caret-right',

        // Subprocesses
        'subprocess': 'fa:fa-th-large',
        'embedded-subprocess': 'fa:fa-th'
    };

    return icons[type] || '';
}

/**
 * Generate Mermaid syntax for an element based on its type
 * @param {string} id - Sanitized node ID
 * @param {string} label - Display label
 * @param {string} type - Element type
 * @param {string} identifier - Element identifier for specific checks
 * @returns {string} Mermaid node syntax
 */
function getMermaidNode(id, label, type, identifier) {
    // Get icon for type
    const icon = getElementIcon(type, identifier);

    // For events and gateways (now icons), we generally want only the icon
    let safeLabel = '';

    if (type.startsWith('start') || type.startsWith('end') || type.startsWith('intermediate') || type.startsWith('gateway')) {
        safeLabel = icon || '';
        // Handle empty final event if requested
        if (type === 'end' && !icon) {
            safeLabel = '';
        }
    } else {
        // Tasks: Icon + Label
        const iconPrefix = icon ? `${icon} ` : '';
        safeLabel = `${iconPrefix}${(label || 'Unnamed').replace(/"/g, '\\"')}`;
    }

    // Start events 
    if (type.startsWith('start')) {
        if (identifier === 'event_inicio') {
            // "event_inicio" -> Single circle with fa-circle
            return `    ${id}(("${safeLabel}"))\n    class ${id} startEvent`;
        }
        if (type === 'start') {
            // Default Simple start - Double Circle
            return `    ${id}((("${safeLabel}")))\n    class ${id} startEvent`;
        }
        return `    ${id}(("${safeLabel}"))\n    class ${id} startEvent`;
    }

    // End events 
    if (type.startsWith('end')) {
        return `    ${id}(("${safeLabel}"))\n    class ${id} endEvent`;
    }

    // Intermediate events 
    if (type.startsWith('intermediate')) {
        return `    ${id}((("${safeLabel}")))\n    class ${id} intermediate`;
    }

    // Gateways
    if (type.startsWith('gateway')) {
        // Gateways now use icons inside the diamond
        return `    ${id}{"${safeLabel}"}\n    class ${id} gateway`;
    }

    // Subprocesses
    if (type.includes('subprocess')) {
        return `    ${id}[["${safeLabel}"]] \n    class ${id} task`;
    }

    // Tasks
    return `    ${id}["${safeLabel}"]\n    class ${id} task`;
}

/**
 * Generate Mermaid diagram from process diagram data
 * @param {string} diagramPath - Path to the diagram folder
 * @param {Object} diagramData - Full diagram JSON data
 */
function generateDiagramMermaid(diagramPath, diagramData) {
    if (!diagramData) {
        return;
    }

    try {
        logger.debug('   🎨 Generating Mermaid diagram...');

        // Collect all active elements with their positions
        const allElements = [];
        const elementTypeMapping = new Map(); // Map element _id to {type, name, sanitizedId}
        const destinationLinks = []; // Store special links

        // Process tasks
        if (diagramData.tasks) {
            diagramData.tasks.forEach(task => {
                if (task.active !== false) {
                    let symbolType = getElementType(task.symbol?._id);
                    const folderName = task.name ? sanitizeFolderName(task.name) : (task.identifier || task._id);
                    const sanitizedId = sanitizeId(task.identifier || task._id);

                    let elementType = 'task';

                    // --- RECLASSIFICATIONS ---
                    if (task.identifier === 'event_recebimentoMensagem') {
                        elementType = 'event';
                        symbolType = 'intermediate-envelope';
                    }
                    else if (task.identifier === 'event_destino') {
                        elementType = 'event';
                        symbolType = 'intermediate-caret-left';
                    }
                    else if (task.identifier === 'event_origim') {
                        elementType = 'event';
                        symbolType = 'intermediate-caret-right';

                        // Check for destinationElementId in settings
                        if (task.settings && task.settings.destinationElementId) {
                            destinationLinks.push({
                                sourceId: sanitizedId,
                                targetElementId: task.settings.destinationElementId
                            });
                        }
                    }

                    allElements.push({
                        ...task,
                        elementType,
                        symbolType,
                        folderName,
                        sanitizedId,
                        identifier: task.identifier // Ensure we pass identifier
                    });
                    elementTypeMapping.set(task._id, { type: 'tasks', name: folderName, sanitizedId });
                    // Also map by elementId (settings.elementId) if available, for destination links
                    if (task.settings && task.settings.elementId) {
                        elementTypeMapping.set(task.settings.elementId, { type: 'tasks', name: folderName, sanitizedId });
                    }
                }
            });
        }

        // Process subprocesses
        if (diagramData.subprocesses) {
            diagramData.subprocesses.forEach(subprocess => {
                if (subprocess.active !== false) {
                    const symbolType = getElementType(subprocess.symbol?._id);
                    const folderName = subprocess.name ? sanitizeFolderName(subprocess.name) : (subprocess.identifier || subprocess._id);
                    const sanitizedId = sanitizeId(subprocess.identifier || subprocess._id);

                    allElements.push({
                        ...subprocess,
                        elementType: 'subprocess',
                        symbolType,
                        folderName,
                        sanitizedId,
                        identifier: subprocess.identifier
                    });
                    elementTypeMapping.set(subprocess._id, { type: 'subprocesses', name: folderName, sanitizedId });
                    if (subprocess.settings && subprocess.settings.elementId) {
                        elementTypeMapping.set(subprocess.settings.elementId, { type: 'subprocesses', name: folderName, sanitizedId });
                    }
                }
            });
        }

        // Process events
        if (diagramData.events) {
            diagramData.events.forEach(event => {
                if (event.active !== false) {
                    let symbolType = getElementType(event.symbol?._id);
                    const folderName = event.name ? sanitizeFolderName(event.name) : (event.identifier || event._id);
                    const sanitizedId = sanitizeId(event.identifier || event._id);

                    // --- RECLASSIFICATIONS for Events ---
                    // Even if they are already in 'events' array, we might want to override the symbolType
                    // This handles cases where user specified override applies to an element that is technically stored as an event but needs custom icon/handling
                    if (event.identifier === 'event_recebimentoMensagem') {
                        symbolType = 'intermediate-envelope';
                    }
                    else if (event.identifier === 'event_destino') {
                        symbolType = 'intermediate-caret-left';
                    }
                    else if (event.identifier === 'event_origim') {
                        symbolType = 'intermediate-caret-right';

                        // Check for destinationElementId
                        if (event.settings && event.settings.destinationElementId) {
                            destinationLinks.push({
                                sourceId: sanitizedId,
                                targetElementId: event.settings.destinationElementId
                            });
                        }
                    }

                    allElements.push({
                        ...event,
                        elementType: 'event',
                        symbolType,
                        folderName,
                        sanitizedId,
                        identifier: event.identifier
                    });
                    elementTypeMapping.set(event._id, { type: 'events', name: folderName, sanitizedId });
                    if (event.settings && event.settings.elementId) {
                        elementTypeMapping.set(event.settings.elementId, { type: 'events', name: folderName, sanitizedId });
                    }
                }
            });
        }

        // Process gateways
        if (diagramData.gateways) {
            diagramData.gateways.forEach(gateway => {
                if (gateway.active !== false) {
                    const symbolType = getElementType(gateway.symbol?._id);
                    const folderName = gateway.name ? sanitizeFolderName(gateway.name) : (gateway.identifier || gateway._id);
                    const sanitizedId = sanitizeId(gateway.identifier || gateway._id);

                    allElements.push({
                        ...gateway,
                        elementType: 'gateway',
                        symbolType,
                        folderName,
                        sanitizedId,
                        identifier: gateway.identifier
                    });
                    elementTypeMapping.set(gateway._id, { type: 'gateways', name: folderName, sanitizedId });
                    if (gateway.settings && gateway.settings.elementId) {
                        elementTypeMapping.set(gateway.settings.elementId, { type: 'gateways', name: folderName, sanitizedId });
                    }
                }
            });
        }

        // Sort elements by position (y first, then x for same row)
        allElements.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        // Filter only connected elements (those that appear in sequence flows)
        const connectedElementIds = new Set();
        if (diagramData.sequenceFlows && diagramData.sequenceFlows.length > 0) {
            diagramData.sequenceFlows.forEach(flow => {
                connectedElementIds.add(flow.source);
                connectedElementIds.add(flow.target);
            });
        }

        // Also add elements involved in destination links if they have a target mapping
        destinationLinks.forEach(link => {
            // We can't easily add the *target* to connectedElementIds here without scanning all,
            // but if the user wants the link, the target *should* be in the diagram.
        });

        // Keep only elements that are connected OR are start/end events
        const connectedElements = allElements.filter(element => {
            const isConnected = connectedElementIds.has(element._id);
            const isStartOrEndEvent = element.symbolType?.startsWith('start') || element.symbolType?.startsWith('end');

            // Reclassified events kept
            if (['event_origim', 'event_destino', 'event_recebimentoMensagem'].includes(element.identifier)) {
                return true;
            }

            return isConnected || isStartOrEndEvent;
        });

        // Update element mapping to include only connected elements
        const connectedElementMapping = new Map();
        connectedElements.forEach(element => {
            const mapping = elementTypeMapping.get(element._id);
            if (mapping) {
                connectedElementMapping.set(element._id, mapping);
                if (element.settings && element.settings.elementId) {
                    connectedElementMapping.set(element.settings.elementId, mapping);
                }
            }
        });

        logger.debug(`   📊 Filtered to ${connectedElements.length} connected elements (from ${allElements.length} total active elements)`);

        // Start building Mermaid diagram
        let mermaid = '%%{init: {\'securityLevel\': \'loose\', \'theme\': \'base\'}}%%\ngraph TD\n\n';

        // Add all elements directly (without subgraphs for better layout)
        connectedElements.forEach(element => {
            const id = element.sanitizedId;
            const label = element.name || element.identifier || 'Unnamed';

            const nodeDefinition = getMermaidNode(id, label, element.symbolType, element.identifier);
            mermaid += nodeDefinition + '\n';
        });

        mermaid += '\n';

        // Add sequence flows (connections)
        if (diagramData.sequenceFlows && diagramData.sequenceFlows.length > 0) {
            mermaid += '  %% Sequence Flows\n';

            diagramData.sequenceFlows.forEach(flow => {
                const sourceMapping = connectedElementMapping.get(flow.source);
                const targetMapping = connectedElementMapping.get(flow.target);

                if (sourceMapping && targetMapping) {
                    const sourceId = sourceMapping.sanitizedId;
                    const targetId = targetMapping.sanitizedId;
                    const label = flow.name ? `|${flow.name}|` : '';

                    mermaid += `  ${sourceId} ==>${label} ${targetId}\n`;
                }
            });
        }

        // Add Destination Links (Dotted)
        if (destinationLinks.length > 0) {
            mermaid += '  %% Destination Links\n';
            destinationLinks.forEach(link => {
                const targetMapping = elementTypeMapping.get(link.targetElementId); // Use broad mapping to find target even if not "connected" via sequence
                if (targetMapping) {
                    // -.- gives dotted line without arrow
                    mermaid += `  ${link.sourceId} -.- ${targetMapping.sanitizedId}\n`;
                }
            });
        }

        // Add styling
        mermaid += '\n  %% Styling\n';
        mermaid += '  classDef startEvent fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#000,width:30px,height:30px\n';
        mermaid += '  classDef intermediate fill:#fff3cd,stroke:#ffc107,stroke-width:2px,color:#000,width:30px,height:30px\n';
        mermaid += '  classDef endEvent fill:#f8d7da,stroke:#dc3545,stroke-width:3px,color:#000,width:30px,height:30px\n';
        mermaid += '  classDef task fill:#cfe2ff,stroke:#0d6efd,stroke-width:2px,color:#000\n';
        mermaid += '  classDef gateway fill:#e7f1ff,stroke:#0066cc,stroke-width:2px,color:#000\n';

        // Save to file (now .mmd)
        const outputPath = path.join(diagramPath, 'diagram.mmd');
        fs.writeFileSync(outputPath, mermaid);

        logger.debug(`   🎨 Generated Mermaid diagram with ${connectedElements.length} connected elements`);
    } catch (error) {
        logger.warn(`   ⚠ Failed to generate Mermaid diagram: ${error.message}`);
    }
}

module.exports = {
    generateDiagramMermaid
};
