'use client'

import { useState } from 'react'

export default function Home() {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Next.js + Docker 示例
        </h1>
        
        <div className="bg-white/30 p-8 rounded-lg shadow-lg">
          <p className="text-2xl text-center mb-4">
            当前计数: {count}
          </p>
          
          <div className="flex justify-center gap-4">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              onClick={() => setCount(count + 1)}
            >
              增加
            </button>
            
            <button
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              onClick={() => setCount(count - 1)}
            >
              减少
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-gray-400">
          这个应用运行在 Docker 容器中
        </p>
      </div>
    </main>
  )
} 