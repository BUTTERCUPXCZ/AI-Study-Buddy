import { LoadingSpinner } from "./LoadingSpinner"
import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <LoadingSpinner
      className={cn("size-4", className)}
      {...props}
    />
  )
}

export { Spinner }
