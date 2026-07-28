import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const APP_VERSION = __APP_VERSION__
const GITHUB_URL = "https://github.com/Fan-7SZ/tsat"
const COPYRIGHT_YEAR = "2026"

// lucide-react ships no brand icons, so the GitHub mark is inlined here.
function GithubIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.33-1.73-1.33-1.73-1.09-.73.08-.71.08-.71 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.13 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.83.56A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  )
}

export function AboutDialog({
  shown,
  setShown,
}: {
  shown: boolean
  setShown: (shown: boolean) => void
}) {
  return (
    <Dialog open={shown} onOpenChange={setShown}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>About TSAT</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <img
            src="/pwa-192x192.png"
            alt="TSAT logo"
            className="size-12 rounded-xl shadow-sm ring-1 ring-foreground/10"
          />
          <div className="flex flex-col gap-0.5">
            <span className="heading-4">TSAT</span>
            <span className="monospaced paragraph-mini text-muted-foreground">
              Version {APP_VERSION}
            </span>
          </div>
          <Button asChild variant="outline" size="lg" className="ml-auto">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GithubIcon />
              GitHub
            </a>
          </Button>
        </div>

        <p className="paragraph-small text-muted-foreground">
          TSAT — Task Splitting And Tracking. Break big goals down into
          manageable tasks, map out the dependencies between them, and keep
          track of your progress all the way to the finish line. For more
          information, visit the help page and the GitHub repository.
        </p>
        <div className="mt-2 flex flex-col items-end gap-1 text-right">
          <div className="flex items-center gap-1">
            <span className="paragraph-mini text-muted-foreground">
              Developed by
            </span>
            <img
              src="/tz.svg"
              alt="Developer"
              className="h-7 w-auto dark:invert"
            />
          </div>

          <p className="paragraph-mini text-muted-foreground">
            © {COPYRIGHT_YEAR} TSAT. All rights reserved.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
