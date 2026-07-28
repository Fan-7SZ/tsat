import { Input } from "../ui/input"

export function SearchBar({ placeholder }: { placeholder?: string }) {
  return (
    <div className="relative">
      <Input placeholder={placeholder} className="pr-10"></Input>
    </div>
  )
}
