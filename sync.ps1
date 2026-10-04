#!/usr/bin/env pwsh
<#
.SYNOPSIS
    把所有插件子模块前进到各自远端 main 的最新提交，并记录新的 pin。

.DESCRIPTION
    父仓库钉住的是固定 commit，所以普通的 git pull 只会把子模块对齐到「已经记录过」
    的那个 commit——别人在插件仓库里推了新东西，这里不会自动跟。这个脚本负责「跟到最新」：

      1. git submodule update --init --recursive   确保子模块都在
      2. git submodule update --remote --merge     每个子模块快进到 origin/main
      3. 报告哪些插件的 pin 动了

    默认只改工作区、不提交；加 -Commit 才提交这次 pin 变更，而且只提交子模块指针，
    仓库里别的无关改动不会被顺手带进去。

    （如果只是想让子模块对齐到父仓库已经记录的 commit，那不需要这个脚本——
    本机设了 submodule.recurse=true 之后，git pull 自己就会做。）

.PARAMETER Commit
    把新的 pin 提交到父仓库（之后再 git push 才算发布）。

.PARAMETER Message
    -Commit 时的提交信息，默认一句通用说明。

.EXAMPLE
    ./sync.ps1
    ./sync.ps1 -Commit
    ./sync.ps1 -Commit -Message "chore: 更新 dsh-ocr 到 0.3"
#>
[CmdletBinding()]
param(
    [switch]$Commit,
    [string]$Message
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .git)) {
    Write-Error "这里不是 git 仓库的根目录：$PSScriptRoot"
    exit 1
}

# 子模块路径取自 .gitmodules。后面只 stage 这些路径，
# 免得把父仓库里别的手改/未跟踪文件一起提交进去。
$subPaths = @(
    git config -f .gitmodules --get-regexp '^submodule\..*\.path$' |
        ForEach-Object { ($_ -split '\s+', 2)[1] }
)
if ($subPaths.Count -eq 0) {
    Write-Error '.gitmodules 里没有子模块'
    exit 1
}

Write-Host '1/2 初始化并拉取子模块…'
git submodule update --init --recursive
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '2/2 把每个子模块快进到 origin/main…'
git submodule update --remote --merge
if ($LASTEXITCODE -ne 0) {
    Write-Warning '有子模块无法自动快进（多半是里面有未提交的改动）。'
    Write-Warning '进去手动处理后重跑，或先 git -C <子模块> stash。'
    exit $LASTEXITCODE
}

# 判断 pin 有没有动用 git submodule summary：干净时它没有输出。
# 不要用 git status —— 那会把父仓库里任何无关改动都算成「pin 变了」。
$summary = @(git submodule summary)
if ($summary.Count -eq 0) {
    Write-Host ''
    Write-Host '所有插件都已经是最新，没有 pin 变化。'
    exit 0
}

Write-Host ''
Write-Host '这些插件的 pin 变了（父仓库记录的还是旧 commit）：'
$summary | ForEach-Object { Write-Host "  $_" }

if (-not $Commit) {
    Write-Host ''
    Write-Host '（尚未提交）满意就跑：./sync.ps1 -Commit'
    exit 0
}

$msg = if ($Message) { $Message } else { 'chore: 更新插件子模块到各自 main 最新提交' }
git add -- $subPaths
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git commit -m $msg
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host '已提交。别忘了 git push 才算发布：'
Write-Host '  git push'
