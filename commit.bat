@echo off
REM ============================================
REM  提交并推送至已初始化的 GitHub 仓库（排除脚本自身）
REM ============================================

REM 1. 输入你的 session ID（例如中国身份证号）
set /p sessionId="请输入你的 session ID: "

REM 2. 暂存所有文件，但排除当前脚本自身
set "self=%~nx0"
git add .
git reset -- "%self%" 2>nul

REM 3. 提交
git commit -m "%sessionId%"

REM 4. 推送到远程仓库（假设已关联 origin 并设置上游分支）
git push

REM 5. 显示完整 commit ID（复制填表用）
echo.
echo 完整 commit ID 如下：
git log --format=%%H -1

pause