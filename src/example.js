// 示例文件，用于演示工具使用

/**
 * 这是一个示例文件，用来演示mini-gemini的文件读取功能
 */

class Calculator {
  constructor() {
    this.history = [];
  }

  add(a, b) {
    const result = a + b;
    this.history.push(`${a} + ${b} = ${result}`);
    return result;
  }

  multiply(a, b) {
    const result = a * b;
    this.history.push(`${a} * ${b} = ${result}`);
    return result;
  }

  getHistory() {
    return this.history;
  }
}

// 使用示例
const calc = new Calculator();
console.log('2 + 3 =', calc.add(2, 3));
console.log('4 * 5 =', calc.multiply(4, 5));
console.log('History:', calc.getHistory());