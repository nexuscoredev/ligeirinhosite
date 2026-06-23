# Servidor local de impressao silenciosa do totem (sem Node, sem popup).
# Uso: powershell -File totem-servidor-impressao.ps1 -PrinterName "ELGIN i9"
param(
    [string]$PrinterName = 'ELGIN i9',
    [string]$ListenHost = '127.0.0.1',
    [int]$Port = 8787
)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class LigeirinhoRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool Send(string name, byte[] payload) {
    IntPtr h;
    if (!OpenPrinter(name, out h, IntPtr.Zero)) return false;
    var di = new DOCINFOA { pDocName = "Ligeirinho Totem", pDataType = "RAW" };
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return false; }
    StartPagePrinter(h);
    IntPtr p = Marshal.AllocCoTaskMem(payload.Length);
    Marshal.Copy(payload, 0, p, payload.Length);
    int written;
    WritePrinter(h, p, payload.Length, out written);
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h);
    EndDocPrinter(h);
    ClosePrinter(h);
    return true;
  }
}
'@

function Format-Money([decimal]$value) {
    return $value.ToString('C', [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR'))
}

function Get-MethodLabel($method) {
    switch ([string]$method).ToLower()) {
        'pix' { return 'Pix' }
        'cartao' { return 'Cartao debito/credito' }
        default { return 'Dinheiro' }
    }
}

function Get-CompactCode($id) {
    $clean = [string]$id -replace '[^a-fA-F0-9]', ''
    if (-not $clean) { return '' }
    $raw = $clean.Substring(0, [Math]::Min(8, $clean.Length)).ToUpper()
    return "PED $raw"
}

function Build-EscPosReceipt($order, $totemLabel, $width) {
    $esc = [char]27
    $gs = [char]29
    $unit = if ($order.totemLabel) { $order.totemLabel } elseif ($totemLabel) { $totemLabel } else { 'Ligeirinho Totem' }
    $code = Get-CompactCode $order.id
    $created = if ($order.createdAt) { [datetime]$order.createdAt } else { Get-Date }
    $createdText = $created.ToString('dd/MM/yyyy HH:mm', [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR'))

    $center = {
        param($text)
        $t = [string]$text
        if ($t.Length -ge $width) { return $t.Substring(0, $width) }
        $pad = [Math]::Floor(($width - $t.Length) / 2)
        return (' ' * $pad) + $t
    }

    $padLine = {
        param($left, $right)
        $l = [string]$left
        $r = [string]$right
        $spaces = [Math]::Max(1, $width - $l.Length - $r.Length)
        return $l + (' ' * $spaces) + $r
    }

    $divider = '-' * $width
    $lines = @(
        & $center $unit.ToUpper()
        & $center 'COMPROVANTE DE PEDIDO'
        & $center 'Apresente no caixa'
        $divider
        & $center 'CODIGO DO PEDIDO'
        & $center $code
        & $center $createdText
        $divider
    )

    foreach ($item in @($order.items)) {
        $qty = [int]($item.qty)
        if ($qty -lt 1) { $qty = 1 }
        $lineTotal = Format-Money ([decimal]$item.price * $qty)
        $name = ([string]$item.name).Substring(0, [Math]::Min($width - 8, [string]$item.name).Length))
        $lines += & $padLine "$qty`x $name" $lineTotal
    }

    $pay = Get-MethodLabel ($order.paymentMethod)
    if (-not $pay -and $order.payment_method) { $pay = Get-MethodLabel $order.payment_method }
    $lines += $divider
    $lines += & $padLine 'Pagamento' $pay
    $lines += & $padLine 'TOTAL' (Format-Money ([decimal]$order.total))
    $lines += $divider
    $lines += & $center 'Ligeirinho Parceiros'
    $lines += ''

    $out = $esc + '@' + $esc + 'a' + [char]1
    foreach ($line in $lines) { $out += $line + "`n" }
    $out += $esc + 'a' + [char]0 + "`n`n"
    $out += $gs + 'V' + [char]0

    return [System.Text.Encoding]::GetEncoding(28591).GetBytes($out)
}

function Send-Json($context, $statusCode, $obj) {
    $json = ($obj | ConvertTo-Json -Compress)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $context.Response.StatusCode = $statusCode
    $context.Response.ContentType = 'application/json; charset=utf-8'
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
}

$prefix = "http://${ListenHost}:${Port}/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "[ligeirinho] Impressao silenciosa em $prefix"
Write-Host "[ligeirinho] Impressora: $PrinterName"
Write-Host "[ligeirinho] Nao feche esta janela.`n"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $response.AppendHeader('Access-Control-Allow-Origin', '*')
    $response.AppendHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    $response.AppendHeader('Access-Control-Allow-Headers', 'Content-Type')
    $response.AppendHeader('Access-Control-Allow-Private-Network', 'true')

    try {
        if ($request.HttpMethod -eq 'OPTIONS') {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq 'GET' -and $request.Url.AbsolutePath -eq '/health') {
            Send-Json $context 200 @{ ok = $true; printerName = $PrinterName }
            continue
        }

        if ($request.HttpMethod -ne 'POST' -or $request.Url.AbsolutePath -ne '/print') {
            Send-Json $context 404 @{ error = 'Use POST /print' }
            continue
        }

        $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
        $bodyText = $reader.ReadToEnd()
        $body = $bodyText | ConvertFrom-Json
        if (-not $body.order.id) {
            Send-Json $context 400 @{ error = 'Pedido invalido' }
            continue
        }

        $bytes = Build-EscPosReceipt $body.order $body.totemLabel 42
        if (-not [LigeirinhoRawPrinter]::Send($PrinterName, $bytes)) {
            throw "Falha ao imprimir em '$PrinterName'. Confira o nome no Windows."
        }

        Send-Json $context 200 @{ ok = $true }
    }
    catch {
        Write-Warning $_.Exception.Message
        Send-Json $context 500 @{ error = $_.Exception.Message }
    }
}
