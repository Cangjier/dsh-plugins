#!/usr/bin/env pwsh
<#
.SYNOPSIS
    克隆 dsh-plugins，并把所有插件子模块一次拉全。

.DESCRIPTION
    等价于 git clone --recurse-submodules，只是省得记这个参数。
    只想敲一次的话，也可以给本机做全局配置（见 README「让 clone / pull 永久自动」），
    那样普通的 git clone / git pull 就会自己递归。

.PARAMETER Dir
    克隆到哪个目录，默认 dsh-plugins。

.PARAMETER Repo
    仓库地址，默认本项目的 GitHub 地址。

.EXAMPLE
    ./clone.ps1
    ./clone.ps1 -Dir D:\work\dsh-plugins
#>
[CmdletBinding()]
param(
    [string]$Dir  = 'dsh-plugins',
    [string]$Repo = 'https://github.com/Cangjier/dsh-plugins.git'
)

$ErrorActionPreference = 'Stop'

if (Test-Path $Dir) {
    Write-Error "目标目录已存在：$Dir（换个 -Dir，或先把旧目录移走）"
    exit 1
}

Write-Host "克隆 $Repo -> $Dir（含全部子模块）…"
git clone --recurse-submodules $Repo $Dir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host '完成。各插件当前的 commit：'
git -C $Dir submodule status
