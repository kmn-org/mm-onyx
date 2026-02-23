import { Tag, ValidSources } from "../types";
import { Filters, OnyxDocument, SourceMetadata } from "./interfaces";
import { DateRangePickerValue } from "@/components/dateRangeSelectors/AdminDateRangeSelector";

export const buildFilters = (
  sources: SourceMetadata[],
  documentSets: string[],
  timeRange: DateRangePickerValue | null,
  tags: Tag[]
): Filters => {
  const filters = {
    source_type:
      sources.length > 0 ? sources.map((source) => source.internalName) : null,
    document_set: documentSets.length > 0 ? documentSets : null,
    time_cutoff: timeRange?.from ? timeRange.from : null,
    tags: tags,
  };

  return filters;
};

export function endsWithLetterOrNumber(str: string) {
  return /[a-zA-Z0-9]$/.test(str);
}

// If we have a real URL link, open it in a new tab.
// Fragment-only links (e.g. "#page=3") are internal position anchors — open the modal instead.
// If there is no link, try to present via modal for file sources.
export const openDocument = (
  document: OnyxDocument,
  updatePresentingDocument?: (document: OnyxDocument) => void
) => {
  const isFragmentOnly = document.link?.startsWith("#") ?? false;
  if (document.link && !isFragmentOnly) {
    window.open(document.link, "_blank");
  } else {
    updatePresentingDocument?.(document);
  }
};
