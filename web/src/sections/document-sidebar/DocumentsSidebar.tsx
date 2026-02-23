"use client";

import { MinimalOnyxDocument, OnyxDocument } from "@/lib/search/interfaces";
import ChatDocumentDisplay from "@/sections/document-sidebar/ChatDocumentDisplay";
import { Dispatch, SetStateAction, useMemo, memo } from "react";
import { getCitations } from "@/app/app/services/packetUtils";
import {
  useCurrentMessageTree,
  useSelectedNodeForDocDisplay,
} from "@/app/app/stores/useChatSessionStore";
import Text from "@/refresh-components/texts/Text";
import IconButton from "@/refresh-components/buttons/IconButton";
import { SvgSearchMenu, SvgX } from "@opal/icons";
import Separator from "@/refresh-components/Separator";

// Build an OnyxDocument from basic file info
const buildOnyxDocumentFromFile = (
  id: string,
  name?: string | null,
  appendProjectPrefix?: boolean
): OnyxDocument => {
  const document_id = appendProjectPrefix ? `project_file__${id}` : id;
  return {
    document_id,
    semantic_identifier: name || id,
    link: "",
    source_type: "file" as any,
    blurb: "",
    boost: 0,
    hidden: false,
    score: 1,
    chunk_ind: 0,
    match_highlights: [],
    metadata: {},
    updated_at: null,
    is_internet: false,
  } as any;
};

/** Group documents by document_id, deduplicating by (document_id, chunk_ind). */
function groupDocuments(docs: OnyxDocument[]): Map<string, OnyxDocument[]> {
  const seenChunks = new Set<string>();
  const groups = new Map<string, OnyxDocument[]>();
  docs.forEach((doc) => {
    const chunkKey = `${doc.document_id}::${doc.chunk_ind}`;
    if (seenChunks.has(chunkKey)) return;
    seenChunks.add(chunkKey);
    if (!groups.has(doc.document_id)) groups.set(doc.document_id, []);
    groups.get(doc.document_id)!.push(doc);
  });
  return groups;
}

interface HeaderProps {
  children: string;
  count?: number;
  onClose: () => void;
}

function Header({ children, count, onClose }: HeaderProps) {
  return (
    <div className="sticky top-0 z-sticky bg-background-tint-01">
      <div className="flex flex-row w-full items-center justify-between gap-2 py-3">
        <div className="flex items-center gap-2 w-full px-3">
          <SvgSearchMenu className="w-[1.3rem] h-[1.3rem] stroke-text-03" />
          <Text as="p" headingH3 text03>
            {children}
          </Text>
          {count !== undefined && (
            <span className="ml-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-background-200 text-text-500 tabular-nums leading-none">
              {count}
            </span>
          )}
        </div>
        <IconButton
          icon={SvgX}
          tertiary
          onClick={onClose}
          tooltip="Close Sidebar"
        />
      </div>
      <Separator noPadding />
    </div>
  );
}

interface ChatDocumentDisplayWrapperProps {
  children?: React.ReactNode;
}

function ChatDocumentDisplayWrapper({
  children,
}: ChatDocumentDisplayWrapperProps) {
  return (
    <div className="flex flex-col gap-1 items-center justify-center">
      {children}
    </div>
  );
}

interface DocumentsSidebarProps {
  closeSidebar: () => void;
  selectedDocuments: OnyxDocument[] | null;
  modal: boolean;
  setPresentingDocument: Dispatch<SetStateAction<MinimalOnyxDocument | null>>;
}

const DocumentsSidebar = memo(
  ({
    closeSidebar,
    modal,
    selectedDocuments,
    setPresentingDocument,
  }: DocumentsSidebarProps) => {
    const idOfMessageToDisplay = useSelectedNodeForDocDisplay();
    const currentMessageTree = useCurrentMessageTree();

    const selectedMessage = idOfMessageToDisplay
      ? currentMessageTree?.get(idOfMessageToDisplay)
      : null;

    // Get citations in order and build a set of cited document IDs
    const { citedDocumentIds, citationOrder } = useMemo(() => {
      if (!selectedMessage) {
        return {
          citedDocumentIds: new Set<string>(),
          citationOrder: new Map<string, number>(),
        };
      }

      const citedDocumentIds = new Set<string>();
      const citationOrder = new Map<string, number>();
      const citations = getCitations(selectedMessage.packets);
      citations.forEach((citation, index) => {
        citedDocumentIds.add(citation.document_id);
        if (!citationOrder.has(citation.document_id)) {
          citationOrder.set(citation.document_id, index);
        }
      });
      return { citedDocumentIds, citationOrder };
    }, [idOfMessageToDisplay, selectedMessage?.packets.length]);

    if (!selectedMessage || !currentMessageTree) return null;

    const humanMessage = selectedMessage.parentNodeId
      ? currentMessageTree.get(selectedMessage.parentNodeId)
      : null;
    const humanFileDescriptors = humanMessage?.files.filter(
      (file) => file.user_file_id !== null
    );
    const selectedDocumentIds =
      selectedDocuments?.map((document) => document.document_id) || [];

    const currentDocuments = selectedMessage.documents || null;

    // Group all documents by document_id, preserving all chunks
    const allGroups = groupDocuments(currentDocuments || []);

    // Separate into cited groups (sorted by citation order) and other groups
    const allGroupEntries = Array.from(allGroups.entries());

    const citedGroupEntries = allGroupEntries
      .filter(([docId]) => citedDocumentIds.has(docId))
      .sort(([aId], [bId]) => {
        const orderA = citationOrder.get(aId) ?? Infinity;
        const orderB = citationOrder.get(bId) ?? Infinity;
        return orderA - orderB;
      });

    const otherGroupEntries = allGroupEntries.filter(
      ([docId]) => !citedDocumentIds.has(docId)
    );

    const hasCited = citedGroupEntries.length > 0;
    const hasOther = otherGroupEntries.length > 0;

    return (
      <div
        id="onyx-chat-sidebar"
        className="bg-background-tint-01 overflow-y-scroll h-full w-full border-l"
      >
        <div className="flex flex-col px-3 gap-6">
          {hasCited && (
            <div>
              <Header onClose={closeSidebar} count={citedGroupEntries.length}>
                Cited Sources
              </Header>
              <ChatDocumentDisplayWrapper>
                {citedGroupEntries.map(([docId, chunks]) =>
                  chunks.map((chunk, i) => (
                    <ChatDocumentDisplay
                      key={`${docId}::${chunk.chunk_ind}`}
                      setPresentingDocument={setPresentingDocument}
                      modal={modal}
                      document={chunk}
                      isSelected={selectedDocumentIds.includes(chunk.document_id)}
                      totalGroupChunks={chunks.length > 1 ? chunks.length : undefined}
                      chunkIndexInGroup={chunks.length > 1 ? i : undefined}
                      citationCount={i === 0 && chunks.length > 1 ? chunks.length : undefined}
                    />
                  ))
                )}
              </ChatDocumentDisplayWrapper>
            </div>
          )}

          {hasOther && (
            <div>
              <Header
                onClose={closeSidebar}
                count={otherGroupEntries.length}
              >
                {citedGroupEntries.length > 0 ? "More" : "Found Sources"}
              </Header>
              <ChatDocumentDisplayWrapper>
                {otherGroupEntries.map(([docId, chunks]) => (
                  // For "other" section show only the best chunk (highest score)
                  <ChatDocumentDisplay
                    key={docId}
                    setPresentingDocument={setPresentingDocument}
                    modal={modal}
                    document={
                      chunks.reduce((best, c) =>
                        (c.score ?? 0) > (best.score ?? 0) ? c : best
                      )
                    }
                    isSelected={selectedDocumentIds.includes(docId)}
                  />
                ))}
              </ChatDocumentDisplayWrapper>
            </div>
          )}

          {humanFileDescriptors && humanFileDescriptors.length > 0 && (
            <div>
              <Header onClose={closeSidebar} count={humanFileDescriptors.length}>
                User Files
              </Header>
              <ChatDocumentDisplayWrapper>
                {humanFileDescriptors.map((file) => (
                  <ChatDocumentDisplay
                    key={file.id}
                    setPresentingDocument={setPresentingDocument}
                    modal={modal}
                    document={buildOnyxDocumentFromFile(
                      file.id,
                      file.name,
                      false
                    )}
                    isSelected={false}
                  />
                ))}
              </ChatDocumentDisplayWrapper>
            </div>
          )}
        </div>
      </div>
    );
  }
);
DocumentsSidebar.displayName = "DocumentsSidebar";

export default DocumentsSidebar;
