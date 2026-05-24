import { useState } from "react";
import type { FsClient } from "@fileoctopus/ts-api";

export interface FolderTreeProps {
  fs: FsClient;
  rootUri: string;
  rootLabel: string;
  onSelect: (uri: string) => void;
}

interface TreeNodeData {
  name: string;
  uri: string;
}

interface TreeNodeProps {
  fs: FsClient;
  name: string;
  uri: string;
  depth: number;
  onSelect: (uri: string) => void;
}

function TreeNode({ fs, name, uri, depth, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNodeData[]>([]);
  const [loaded, setLoaded] = useState(false);

  const handleToggle = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    if (loaded) {
      setExpanded(true);
      return;
    }

    fs.listDirectories({ uri })
      .then((result) => {
        setChildren(result.directories);
        setLoaded(true);
        setExpanded(true);
      })
      .catch(() => {
        setChildren([]);
        setLoaded(true);
        setExpanded(true);
      });
  };

  const indent = depth * 16;

  return (
    <li role="treeitem" aria-expanded={expanded}>
      <div className="fo-folder-tree-node" style={{ paddingLeft: indent }}>
        <button
          type="button"
          className="fo-folder-tree-toggle"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={handleToggle}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <button
          type="button"
          className="fo-folder-tree-label"
          onClick={() => onSelect(uri)}
          title={uri}
        >
          {name}
        </button>
      </div>
      {expanded ? (
        <ul role="group" className="fo-folder-tree-children">
          {children.length === 0 ? (
            <li
              className="fo-folder-tree-empty"
              style={{ paddingLeft: indent + 16 }}
            >
              Empty
            </li>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.uri}
                fs={fs}
                name={child.name}
                uri={child.uri}
                depth={depth + 1}
                onSelect={onSelect}
              />
            ))
          )}
        </ul>
      ) : null}
    </li>
  );
}

export function FolderTree({
  fs,
  rootUri,
  rootLabel,
  onSelect,
}: FolderTreeProps) {
  return (
    <div className="fo-folder-tree" role="tree" aria-label="Folder tree">
      <ul role="group" className="fo-folder-tree-root">
        <TreeNode
          fs={fs}
          name={rootLabel}
          uri={rootUri}
          depth={0}
          onSelect={onSelect}
        />
      </ul>
    </div>
  );
}
