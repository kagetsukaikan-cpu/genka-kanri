// 仕入先名を短縮（「花月会館（株式会社アライホテルズ）」→「花月会館」）
export function shortSupplierName(name: string): string {
  return name.split(/[（(]/)[0].trim()
}
