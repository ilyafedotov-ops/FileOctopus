import React from "react";

const filesLeft = [
  { icon: "📁", name: "Camera Roll", size: "—", modified: "Today, 14:32", type: "Folder" },
  { icon: "📁", name: "Wallpapers", size: "—", modified: "Today, 10:15", type: "Folder" },
  { icon: "🖼️", name: "DSC_0124.jpg", size: "3.8 MB", modified: "Today, 14:30", type: "JPEG Image", selected: true },
  { icon: "🎬", name: "Video_001.mp4", size: "52.1 MB", modified: "Yesterday", type: "MP4 Video" },
  { icon: "📄", name: "notes.txt", size: "2 KB", modified: "Aug 21, 2025", type: "Text Document" },
];

const filesRight = [
  { icon: "📁", name: "Projects", size: "—", modified: "Today, 09:12", type: "Folder" },
  { icon: "📁", name: "Reports", size: "—", modified: "Aug 25, 2025", type: "Folder" },
  { icon: "📕", name: "Presentation.pdf", size: "2.4 MB", modified: "Aug 27, 2025", type: "PDF Document" },
  { icon: "📊", name: "Todo.xlsx", size: "1.1 MB", modified: "Today, 08:45", type: "Spreadsheet" },
  { icon: "📄", name: "README.md", size: "8 KB", modified: "Aug 20, 2025", type: "Markdown" },
];

function SidebarItem({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}>
      <span className="w-5 text-center">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ToolbarButton({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm ${primary ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {children}
    </button>
  );
}

function FilePane({ title, path, files, active = false }: { title: string; path: string; files: typeof filesLeft; active?: boolean }) {
  return (
    <section className={`flex min-w-0 flex-1 flex-col rounded-2xl border bg-white ${active ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900">{title}</span>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
            <button>←</button>
            <button>→</button>
            <button>↑</button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">{path}</div>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{title.toUpperCase()}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <ToolbarButton primary>New Folder</ToolbarButton>
        <ToolbarButton>New File</ToolbarButton>
        <ToolbarButton>Rename</ToolbarButton>
        <ToolbarButton>Copy</ToolbarButton>
        <ToolbarButton>Move</ToolbarButton>
        <ToolbarButton>Trash</ToolbarButton>
        <ToolbarButton>Refresh</ToolbarButton>
        <ToolbarButton>More</ToolbarButton>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <input className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" placeholder="Filter current folder..." />
        <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">Details</button>
        <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">Show Hidden</button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Size</th>
              <th className="px-4 py-2 font-semibold">Modified</th>
              <th className="px-4 py-2 font-semibold">Type</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.name} className={`border-t border-slate-100 ${file.selected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <td className="px-4 py-2 font-medium text-slate-800"><span className="mr-2">{file.icon}</span>{file.name}</td>
                <td className="px-4 py-2 text-slate-600">{file.size}</td>
                <td className="px-4 py-2 text-slate-600">{file.modified}</td>
                <td className="px-4 py-2 text-slate-600">{file.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        {active ? "1 of 7 selected · 82.3 MB · 7 items" : "0 selected · 6 items"}
      </div>
    </section>
  );
}

function ActivityPanel() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white xl:flex">
      <div className="border-b border-slate-200 px-4 py-4">
        <h2 className="text-base font-bold text-slate-900">Jobs & Activity</h2>
        <p className="mt-1 text-xs text-slate-500">Current operations and recent history</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-800"><span>Copy 3 items</span><span>56%</span></div>
          <div className="mt-3 h-2 rounded-full bg-slate-200"><div className="h-2 w-7/12 rounded-full bg-blue-600" /></div>
          <div className="mt-2 text-xs text-slate-500">45 MB/s · 00:04 left</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800">
          <div className="font-semibold">Move queued</div>
          <div className="mt-1 text-xs text-slate-500">Vacation → Archive</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-800">
          <div className="font-semibold">Rename complete</div>
          <div className="mt-1 text-xs text-slate-500">5 files renamed</div>
        </div>
      </div>
    </aside>
  );
}

export default function FileOctopusPrototype() {
  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans text-slate-900">
      <div className="mx-auto flex max-w-[1500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-50 px-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐙</span>
            <span className="font-bold">FileOctopus</span>
            <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600">Rust-powered</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700">Settings</button>
          </div>
        </header>

        <main className="flex min-h-[720px] gap-4 bg-slate-100 p-4">
          <aside className="w-56 shrink-0 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Favorites</div>
            <SidebarItem icon="⌂" label="Home" active />
            <SidebarItem icon="▣" label="Desktop" />
            <SidebarItem icon="□" label="Documents" />
            <SidebarItem icon="↓" label="Downloads" />
            <SidebarItem icon="▧" label="Pictures" />
            <SidebarItem icon="♫" label="Music" />
            <div className="mb-2 mt-6 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Devices / Volumes</div>
            <SidebarItem icon="◉" label="Macintosh HD" />
            <SidebarItem icon="◌" label="Backup" />
            <SidebarItem icon="◎" label="Network" />
            <div className="mb-2 mt-6 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent</div>
            <SidebarItem icon="◷" label="Today" />
            <SidebarItem icon="☆" label="Starred" />
          </aside>

          <div className="flex min-w-0 flex-1 gap-4">
            <FilePane title="Left" path="/ Users / ilya / Pictures / 2025" files={filesLeft} active />
            <FilePane title="Right" path="/ Users / ilya / Documents / Projects" files={filesRight} />
          </div>

          <ActivityPanel />
        </main>

        <footer className="flex h-10 items-center justify-between border-t border-slate-200 bg-white px-5 text-xs text-slate-500">
          <span>Ready</span>
          <span>2 selected · 8 items · 82.3 MB selected</span>
          <span>~/fileoctopus/logs · No errors</span>
        </footer>
      </div>
    </div>
  );
}
