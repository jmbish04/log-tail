/**
 * WebSocket handler for real-time log streaming
 * Note: This is a basic implementation. For production use with high concurrency,
 * consider using Durable Objects for WebSocket connections.
 */

import { Env, WebSocketMessage, WebSocketSubscription } from '../types';

/**
 * Handle WebSocket upgrade requests
 */
export async function websocketHandler(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    // Verify WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Optional: Authenticate WebSocket connection
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (env.LOG_SERVICE_API_KEY && token !== env.LOG_SERVICE_API_KEY) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Handle WebSocket connection
    handleWebSocketConnection(server, env, ctx);

    // Return response with WebSocket
    return new Response(null, {
        status: 101,
        webSocket: client,
    });
}

/**
 * Handle WebSocket connection lifecycle
 */
function handleWebSocketConnection(
    ws: WebSocket,
    env: Env,
    ctx: ExecutionContext
) {
    // Accept the WebSocket connection
    ws.accept();

    // Store subscription preferences
    let subscription: WebSocketSubscription = {};

    // Handle incoming messages
    ws.addEventListener('message', async (event: MessageEvent) => {
        try {
            const message: WebSocketMessage = JSON.parse(event.data as string);

            switch (message.type) {
                case 'subscribe':
                    subscription = {
                        service_name: message.service_name,
                        level: message.data?.level,
                    };
                    ws.send(
                        JSON.stringify({
                            type: 'subscribed',
                            subscription,
                        })
                    );
                    break;

                case 'unsubscribe':
                    subscription = {};
                    ws.send(
                        JSON.stringify({
                            type: 'unsubscribed',
                        })
                    );
                    break;

                case 'ping':
                    ws.send(
                        JSON.stringify({
                            type: 'pong',
                            timestamp: Date.now(),
                        })
                    );
                    break;

                default:
                    ws.send(
                        JSON.stringify({
                            type: 'error',
                            error: 'Unknown message type',
                        })
                    );
            }
        } catch (error: any) {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    error: error.message,
                })
            );
        }
    });

    // Handle close event
    ws.addEventListener('close', () => {
        console.log('WebSocket connection closed');
    });

    // Handle error event
    ws.addEventListener('error', (error: any) => {
        console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(
        JSON.stringify({
            type: 'connected',
            message: 'Connected to logging service',
            timestamp: Date.now(),
        })
    );
}

/**
 * Broadcast log to WebSocket clients
 * Note: This is a simplified example. For production, use Durable Objects
 * to manage WebSocket connections and broadcasting.
 */
export function broadcastLog(
    log: any,
    subscription: WebSocketSubscription,
    ws: WebSocket
): void {
    // Check if log matches subscription
    if (subscription.service_name && log.service_name !== subscription.service_name) {
        return;
    }

    if (subscription.level && log.level !== subscription.level) {
        return;
    }

    // Send log to client
    try {
        ws.send(
            JSON.stringify({
                type: 'log',
                data: log,
            })
        );
    } catch (error) {
        console.error('Failed to send log to WebSocket client:', error);
    }
}
