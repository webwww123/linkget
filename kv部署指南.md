# Deno KV 云端部署完全指南

基于实际项目经验，以下是使用Deno KV与Fresh框架的完整部署流程指南。

## 一、前期准备

### 1. 创建Deno KV数据库
```
✅ 登录Deno Dashboard (https://dash.deno.com)
✅ 在项目设置中创建KV数据库 
✅ 记录KV数据库的ID (例如: 33201c53-d0e4-46c2-b2fa-fe8433521278)
```

### 2. 本地开发环境设置
```
✅ 确保使用最新版Deno (>=2.0)
✅ 使用--unstable-kv标志启动本地服务
  deno task start → deno run -A --unstable-kv --watch=static/,routes/ dev.ts
```

## 二、代码实现关键点

### 1. KV连接方式 (重要!)
```typescript
// ✅ 正确方式: 不指定URL，在Deno Deploy中自动连接项目关联的KV
const kv = await Deno.openKv();

// ❌ 错误方式: 在Deno Deploy中不支持指定URL
const kv = await Deno.openKv("https://api.deno.com/databases/你的KV-ID/connect");
```

### 2. KV操作范例
```typescript
// 存储数据
await kv.set(["favorites", userId, linkId], favoriteObject);

// 获取数据
const favorites = [];
const entries = kv.list({ prefix: ["favorites", userId] });
for await (const entry of entries) {
  favorites.push(entry.value);
}

// 删除数据
await kv.delete(["favorites", userId, linkId]);
```

### 3. 主要配置
```json
// deno.json
{
  "tasks": {
    "start": "deno run -A --unstable-kv --watch=static/,routes/ dev.ts",
    "deploy": "deployctl deploy --project=your-project --prod ./main.ts"
  },
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "lib": ["dom", "dom.iterable", "dom.asynciterable", "deno.ns", "deno.unstable"]
  }
}
```

## 三、常见错误与解决方案

### 1. TypeError: Non-default databases are not supported
```
错误信息: TypeError: Non-default databases are not supported
原因: 在Deno Deploy中尝试使用URL连接KV数据库
解决方案: 移除KV连接URL，使用 await Deno.openKv() 不带参数
```

### 2. 权限错误
```
错误信息: PermissionDenied: Requires kv access to open KV
解决方案: 确保使用 --unstable-kv 标志启动应用
```

### 3. 环境变量配置错误
```
错误信息: Error: KV access token not found
解决方案: 在Deno Deploy项目设置中配置DENO_KV_ACCESS_TOKEN环境变量
```

## 四、部署步骤

### 1. 安装部署工具
```bash
deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts
```

### 2. 登录Deno Deploy
```bash
deployctl login
```

### 3. 执行部署
```bash
deno task deploy
# 或者直接使用
deployctl deploy --project=your-project --prod ./main.ts
```

### 4. 项目关联GitHub (推荐)
```
✅ 在Deno Deploy控制面板中关联GitHub仓库
✅ 设置自动部署分支 (通常是main或master)
✅ 配置必要的环境变量
```

## 五、数据持久化与存储特性

### 1. 数据模型
Deno KV使用键值对存储数据，键可以是多层级的数组：
```typescript
// 用户ID作为分区键可以提高查询效率
await kv.set(["users", userId, "profile"], userProfile);
await kv.set(["users", userId, "settings"], userSettings);
```

### 2. 用户标识处理
```typescript
// 生成持久的用户ID
function getUserId() {
  if (typeof localStorage !== 'undefined') {
    let userId = localStorage.getItem("app_userId");
    
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("app_userId", userId);
    }
    
    return userId;
  }
  return "anonymous";
}
```

### 3. 本地与生产环境差异
- 本地环境: 数据存储在本地文件系统
- Deno Deploy: 数据存储在云端KV数据库
- 区别：本地数据不会自动同步到云端，需要手动迁移

## 六、高级技巧

### 1. 事务操作
```typescript
const res = await kv.atomic()
  .check({ key: ["counter"], versionstamp: versionstamp })
  .set(["counter"], newCount)
  .commit();
```

### 2. 使用二级索引进行查询
```typescript
// 创建二级索引
await kv.set(["posts_by_date", post.date, post.id], { value: null });
await kv.set(["posts", post.id], post);

// 使用二级索引查询
const entries = kv.list({ prefix: ["posts_by_date", "2023-06"] });
```

### 3. 性能优化
- 使用合理的键结构，避免过深的嵌套
- 批量操作使用atomic()方法
- 大型集合考虑分页获取

## 七、监控与管理

### 1. 查看数据库大小
在Deno Dashboard可以查看KV数据库的大小和使用情况

### 2. 备份策略
目前Deno KV没有内置备份机制，可考虑定期导出重要数据

### 3. 成本控制
注意KV操作次数，避免过度读写造成不必要的费用

## 八、实际案例总结

在我们的链接提取器项目中，成功使用Deno KV实现了链接收藏功能:

1. 用户在浏览器中有唯一ID (localStorage)
2. 收藏的链接存储在云端KV数据库
3. 按用户ID分组存储，保证数据隔离
4. 客户端与服务端通过API交互，完成增删改查操作

通过合理利用Deno KV，我们实现了零配置、高性能的数据持久化，大大简化了开发流程。 