@echo off
chcp 65001 >nul
title AI聚合大模型 - 一键配置脚本

echo.
echo ============================================
echo    AI聚合 · 智能大模型中转站
echo    一键配置脚本
echo ============================================
echo.

:: 检查 Node.js
echo [1/5] 检查 Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [警告] 未检测到 Node.js，请先安装 Node.js
    echo         下载地址: https://nodejs.org/
    echo.
    echo         部署 Edge Functions 需要 Node.js，但前端可直接使用。
    echo.
) else (
    for /f "tokens=*" %%i in ('node -v') do echo [OK] Node.js 已安装: %%i
)

:: 检查 Supabase CLI
echo.
echo [2/5] 检查 Supabase CLI...
where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [提示] 未检测到 Supabase CLI
    echo        Edge Functions 需要 supabase CLI 部署
    echo        安装命令: npm install -g supabase
    echo        安装后运行: supabase login
) else (
    for /f "tokens=*" %%i in ('supabase -v') do echo [OK] Supabase CLI 已安装: %%i
)

:: 配置 Supabase
echo.
echo [3/5] 配置 Supabase 连接信息...
echo.

set /p SUPABASE_URL="请输入 Supabase URL (如 https://xxxxx.supabase.co): "
set /p SUPABASE_ANON_KEY="请输入 Supabase ANON KEY: "

if not "%SUPABASE_URL%"=="" (
    if not "%SUPABASE_ANON_KEY%"=="" (
        echo.
        echo [OK] 正在更新 js/supabase.js...

        powershell -Command ^
            "$file = 'js\supabase.js';" ^
            "$content = Get-Content $file -Raw -Encoding UTF8;" ^
            "$content = $content -replace 'const SUPABASE_URL = .*;', ('const SUPABASE_URL = \"' + $env:SUPABASE_URL + '\";');" ^
            "$content = $content -replace 'const SUPABASE_ANON_KEY = .*;', ('const SUPABASE_ANON_KEY = \"' + $env:SUPABASE_ANON_KEY + '\";');" ^
            "Set-Content $file $content -Encoding UTF8 -NoNewline"

        echo [OK] 配置已更新
    )
) else (
    echo [跳过] 未输入 Supabase 信息，将使用默认占位值
)

:: 数据库提示
echo.
echo [4/5] 数据库配置...
echo.
echo [提示] 请在 Supabase SQL Editor 中依次执行以下文件:
echo        - supabase\schema.sql  (创建表结构)
echo        - supabase\seed.sql    (插入初始数据)
echo.

:: 初始化 Git
echo [5/5] 初始化 Git 仓库...
git init >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Git 仓库已初始化
) else (
    echo [跳过] Git 初始化失败（可能已存在或未安装 Git）
)

:: 完成
echo.
echo ============================================
echo    配置完成！
echo ============================================
echo.
echo 后续步骤:
echo   1. 在 Supabase SQL Editor 执行 schema.sql 和 seed.sql
echo   2. 部署 Edge Functions:
echo      supabase login
echo      supabase functions deploy ai-proxy
echo      supabase functions deploy generate-codes
echo      supabase functions deploy verify-code
echo   3. 在 Supabase Dashboard 设置 Edge Function 环境变量:
echo      ai-proxy: OPENROUTER_API_KEY
echo   4. 将代码推送到 GitHub 并启用 Pages
echo   5. 在 Supabase SQL Editor 设置管理员:
echo      UPDATE members SET is_admin = true WHERE id = '用户UUID';
echo.
echo 本地测试: 使用任意 HTTP 服务器打开 index.html
echo   npx serve .  或  python -m http.server 8080
echo.
pause
