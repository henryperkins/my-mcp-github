// src/utils/string-builder.ts
/**
 * Efficient string builder for large text concatenation
 */
export class StringBuilder {
  private chunks: string[] = [];
  
  /**
   * Append a string to the builder
   */
  append(str: string): StringBuilder {
    this.chunks.push(str);
    return this;
  }
  
  /**
   * Append a string with a newline
   */
  appendLine(str: string = ""): StringBuilder {
    this.chunks.push(str);
    this.chunks.push("\n");
    return this;
  }
  
  /**
   * Append multiple lines
   */
  appendLines(...lines: string[]): StringBuilder {
    for (const line of lines) {
      this.appendLine(line);
    }
    return this;
  }
  
  /**
   * Clear the builder
   */
  clear(): void {
    this.chunks = [];
  }
  
  /**
   * Get the length of the current content
   */
  get length(): number {
    return this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  }
  
  /**
   * Convert to string
   */
  toString(): string {
    return this.chunks.join("");
  }
  
  /**
   * Create a new StringBuilder with initial content
   */
  static create(initial?: string): StringBuilder {
    const builder = new StringBuilder();
    if (initial) {
      builder.append(initial);
    }
    return builder;
  }
}