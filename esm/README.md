# @karinjs/sqlite3

> A modern ESM-compatible distribution of SQLite3 with pre-built native binaries

[English](#english) | [中文](#中文)

---

## 中文

### 📦 简介

`@karinjs/sqlite3` 是一个现代化的 SQLite3 npm 包，专为 ESM（ECMAScript Modules）环境设计。与传统的 `sqlite3` 包不同，本包采用全新的分发策略，无需在安装时动态下载二进制文件。

### ✨ 核心特性

- 🚀 **纯 ESM 模块**：完全兼容现代 JavaScript 生态系统
- 📦 **预编译二进制文件**：所有平台的 `.node` 文件随包分发
- 🎯 **智能安装**：利用 npm 的 `optionalDependencies` 机制，根据系统环境自动安装对应平台的二进制文件
- 🔧 **零动态下载**：告别 post-install 钩子和网络下载，彻底解决 pnpm 10+ 拦截警告问题
- ⚡ **更快的安装速度**：无需等待编译或下载，安装即可使用
- 🛡️ **更高的可靠性**：避免网络问题导致的安装失败
- 🌍 **全透明构建**：所有构建过程在 CI 环境中完成，完全可追溯

### 🏗️ 构建来源

本包的二进制文件来自本仓库 [sj817/node-sqlite3](https://github.com/sj817/node-sqlite3) 的 GitHub Release。

这是一个将 SQLite3 的 `.node` 二进制文件打包到 npm 的专用仓库，具有以下特点：

- ✅ **全程透明**：所有构建过程在 GitHub Actions 中公开执行
- ✅ **CI/CD 自动化**：使用完整的 CI 环境进行编译、打包和分发
- ✅ **多平台支持**：覆盖 Windows、macOS、Linux 等主流平台
- ✅ **可追溯性**：每个构建版本都有完整的构建日志

### 🆚 与原始 sqlite3 包的区别

| 特性 | sqlite3 | @karinjs/sqlite3 |
|------|---------|------------------|
| 模块格式 | CommonJS | ESM |
| 二进制文件分发 | 动态下载（post-install hook） | npm 可选依赖包 |
| 安装方式 | 需要运行时下载 | 包管理器自动安装 |
| pnpm 兼容性 | ⚠️ pnpm 10+ 有拦截警告 | ✅ 完美兼容 |
| 网络依赖 | ❌ 需要网络连接 | ✅ 无需额外网络请求 |
| 安装速度 | 较慢（需下载） | 更快（直接安装） |
| 离线安装 | ❌ 不支持 | ✅ 完全支持 |

### 📥 安装

```bash
npm install @karinjs/sqlite3
```

```bash
pnpm add @karinjs/sqlite3
```

```bash
yarn add @karinjs/sqlite3
```

### 📖 使用方法

```javascript
import sqlite3 from '@karinjs/sqlite3'

// 创建内存数据库
const db = new sqlite3.Database(':memory:')

// 创建表
db.serialize(() => {
  db.run('CREATE TABLE lorem (info TEXT)')

  const stmt = db.prepare('INSERT INTO lorem VALUES (?)')
  for (let i = 0; i < 10; i++) {
    stmt.run(`Ipsum ${i}`)
  }
  stmt.finalize()

  db.each('SELECT rowid AS id, info FROM lorem', (err, row) => {
    console.log(row.id + ': ' + row.info)
  })
})

db.close()
```

### 🔧 工作原理

`@karinjs/sqlite3` 使用现代化的包管理策略：

1. **主包**：包含 ESM 格式的 JavaScript 代码和类型定义
2. **可选依赖包**：每个平台的二进制文件作为独立的 npm 包发布
3. **智能安装**：通过 `package.json` 中的 `cpu`、`os` 字段，包管理器会自动识别当前环境并只安装匹配的二进制包
4. **运行时加载**：主包在运行时动态加载对应平台的二进制文件

这种方式完全遵循 npm 生态系统的标准，无需任何 hack 或 hook 脚本。

### 📦 支持的平台

- Windows (x64, ia32, arm64)
- macOS (x64, arm64)
- Linux (x64, arm, arm64)
- Android (arm, arm64)

### ⚠️ 关于 @karinjs/sqlite3-cjs

`@karinjs/sqlite3-cjs` 已进入**不再维护状态**，建议所有用户迁移到 `@karinjs/sqlite3`。

新版本提供了更好的性能、更现代的架构，并彻底解决了包管理器兼容性问题。

### 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

- 主仓库：[sj817/node-sqlite3](https://github.com/sj817/node-sqlite3)（二进制构建与本包同仓库）
- 原孵化仓库：[KarinJS/esmify](https://github.com/KarinJS/esmify)（本包已迁出）

### 📄 许可证

MIT

**注意**：本包的 JavaScript 代码采用 MIT 许可证，SQLite3 本身采用公共领域（Public Domain）许可。

---

## English

### 📦 Introduction

`@karinjs/sqlite3` is a modern SQLite3 npm package designed for ESM (ECMAScript Modules) environments. Unlike the traditional `sqlite3` package, this package adopts a new distribution strategy that eliminates the need to dynamically download binary files during installation.

### ✨ Key Features

- 🚀 **Pure ESM Module**: Fully compatible with modern JavaScript ecosystems
- 📦 **Pre-built Binaries**: `.node` files for all platforms are distributed with the package
- 🎯 **Smart Installation**: Utilizes npm's `optionalDependencies` mechanism to automatically install platform-specific binaries based on system environment
- 🔧 **Zero Dynamic Downloads**: No more post-install hooks or network downloads, completely resolving pnpm 10+ interception warnings
- ⚡ **Faster Installation**: No compilation or download wait time, ready to use immediately after installation
- 🛡️ **Higher Reliability**: Avoids installation failures caused by network issues
- 🌍 **Fully Transparent Build**: All build processes completed in CI environment, fully traceable

### 🏗️ Build Source

The binary files in this package come from this repository's own GitHub Releases, [sj817/node-sqlite3](https://github.com/sj817/node-sqlite3).

This is a dedicated repository for packaging SQLite3 `.node` binaries into npm, featuring:

- ✅ **Fully Transparent**: All build processes are publicly executed in GitHub Actions
- ✅ **CI/CD Automation**: Complete CI environment for compilation, packaging, and distribution
- ✅ **Multi-platform Support**: Covers mainstream platforms including Windows, macOS, Linux
- ✅ **Traceability**: Every build version has complete build logs

### 🆚 Differences from Original sqlite3 Package

| Feature | sqlite3 | @karinjs/sqlite3 |
|---------|---------|------------------|
| Module Format | CommonJS | ESM |
| Binary Distribution | Dynamic download (post-install hook) | npm optional dependencies |
| Installation Method | Runtime download required | Package manager auto-install |
| pnpm Compatibility | ⚠️ Warnings in pnpm 10+ | ✅ Perfect compatibility |
| Network Dependency | ❌ Network connection required | ✅ No extra network requests |
| Installation Speed | Slower (requires download) | Faster (direct install) |
| Offline Installation | ❌ Not supported | ✅ Fully supported |

### 📥 Installation

```bash
npm install @karinjs/sqlite3
```

```bash
pnpm add @karinjs/sqlite3
```

```bash
yarn add @karinjs/sqlite3
```

### 📖 Usage

```javascript
import sqlite3 from '@karinjs/sqlite3'

// Create in-memory database
const db = new sqlite3.Database(':memory:')

// Create table
db.serialize(() => {
  db.run('CREATE TABLE lorem (info TEXT)')

  const stmt = db.prepare('INSERT INTO lorem VALUES (?)')
  for (let i = 0; i < 10; i++) {
    stmt.run(`Ipsum ${i}`)
  }
  stmt.finalize()

  db.each('SELECT rowid AS id, info FROM lorem', (err, row) => {
    console.log(row.id + ': ' + row.info)
  })
})

db.close()
```

### 🔧 How It Works

`@karinjs/sqlite3` uses a modern package management strategy:

1. **Main Package**: Contains ESM-formatted JavaScript code and type definitions
2. **Optional Dependency Packages**: Binary files for each platform are published as separate npm packages
3. **Smart Installation**: Through `cpu` and `os` fields in `package.json`, package managers automatically identify the current environment and install only matching binary packages
4. **Runtime Loading**: The main package dynamically loads the corresponding platform binary at runtime

This approach fully complies with npm ecosystem standards, requiring no hacks or hook scripts.

### 📦 Supported Platforms

- Windows (x64, ia32, arm64)
- macOS (x64, arm64)
- Linux (x64, arm, arm64)
- Android (arm, arm64)

### ⚠️ About @karinjs/sqlite3-cjs

`@karinjs/sqlite3-cjs` has entered **maintenance discontinued status**. All users are recommended to migrate to `@karinjs/sqlite3`.

The new version offers better performance, more modern architecture, and completely resolves package manager compatibility issues.

### 🤝 Contributing

Contributions, issue reports, and suggestions are welcome!

- Main Repository: [sj817/node-sqlite3](https://github.com/sj817/node-sqlite3) (binaries are built in the same repo)
- Former Home: [KarinJS/esmify](https://github.com/KarinJS/esmify) (this package has moved out)

### 📄 License

MIT

**Note**: The JavaScript code in this package is licensed under MIT. SQLite3 itself is in the Public Domain.
