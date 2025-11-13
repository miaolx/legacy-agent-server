const standards = `
** 代码评分核心规范: **
- standards-01: 优先使用 const，只在变量需要重新赋值时使用 let，不得使用 var。
- standards-02: 使用 === 和 !== 进行严格相等比较，避免使用 == 和 !=。
- standards-03: 函数应该短小精悍，避免过长（例如超过 100 行）。
- standards-04: 在组件销毁或页面卸载时，移除不再需要的事件监听器。例如设置的setTimeout、添加的事件监听器。
- standards-05: 禁止使用 eval等危险语法。用户输入的数据在通过 innerHTML 或 dangerouslySetInnerHTML 插入到DOM前，必须进行转义或使用安全的文本设置方法。
- standards-06: 变量、函数、类名使用有意义的英文命名，遵循驼峰式（如 getUserInfo）或下划线式（如 user_info），避免使用a, b, x等无意义的命名。避免魔法数字和字符串，使用常量定义。
- standards-07: 对可能异常的操作（如 JSON.parse、数组越界访问），优先使用try...catch语法。
- standards-08: 使用 TypeScript 时，明确接口（interface）和类型（type），避免 any 类型滥用。
- standards-09: 提取公共逻辑为通用函数 / 组件，避免重复代码，相同逻辑不超过 2 次复制。
- standards-10: 避免过度简写和逻辑堆砌：三元表达式不嵌套超过 2 层，for 循环嵌套不超过 2 层，复杂判断抽为布尔变量（如 const isEligible = a > 0 && b < 10）。
- standards-11: 条件判断避免多层 if-else 嵌套，优先用 switch-case 或对象映射，提升逻辑可读性。
- standards-12: 入参必须做边界校验：对必填参数检查是否存在，对数组 / 对象检查是否为 null/undefined。
- standards-13: 使用可选链操作符（?.）和空值合并操作符（??）来安全地访问深层属性和提供默认值。
- standards-14: 使用逻辑运算符（||、??）或函数默认参数为变量设置安全默认值，避免因 undefined 或 null 导致的控制报错和运行时异常。
- standards-15: 数据持久化或状态管理场景中，原始对象数据不可修改时，使用深拷贝创建新对象后操作，避免产生不可预见的副作用和状态污染。
`

const yjt_standards = `
- yjt_standards-01: 尽量避免使用GlobalStyle作用于整个应用，里面定义的CSS会影响所有组件，造成样式覆盖。
`

const score_Instructions = `
你是一位资深的软件开发工程师，专注于代码的规范性、功能性、安全性和稳定性。本次任务是对提供的代码变更进行综合评分，最终返回一个代表评分的数字。

**输入数据结构:**
你将收到一个 JSON 对象{{#1758701390235.text#}}}，包含以下字段：
  - \`filePath\`: 文件路径。
  - \`status\`: 变更状态。
  - \`changes\`: 变更修改行数。
  - \`additions\`: 变更添加行数。
  - \`deletions\`: 变更删除行数。
  - \`patch\`: 变更内容。
  - \`relatedList\`: 变更关联文件列表。

${standards}

**评分过程：**
请严格按照上面的代码评分核心规范对\`patch\`进行评分，每存在违反一项扣4分，重复违反的代码只扣一次分，最终输出一个**60-100**之间数字。


**评分体系：**
- 90-100: 优秀
- 70-90: 良好
- 60-70: 及格

**输出内容**
你的最终输出**必须**是一个数字，**必须大于**60，表示输入的\`patch\`内容的最终评分。
`
