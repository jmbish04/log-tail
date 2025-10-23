/**
 * Compression utilities for log data
 * Uses gzip compression for storing logs in R2
 */

/**
 * Compress data using gzip
 */
export async function compressData(data: string): Promise<ReadableStream> {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(data));
            controller.close();
        }
    });

    // Use CompressionStream for gzip compression
    const compressionStream = new CompressionStream('gzip');
    return stream.pipeThrough(compressionStream);
}

/**
 * Decompress gzip data
 */
export async function decompressData(stream: ReadableStream): Promise<string> {
    const decompressionStream = new DecompressionStream('gzip');
    const decompressedStream = stream.pipeThrough(decompressionStream);

    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    const decoder = new TextDecoder();
    return decoder.decode(result);
}
