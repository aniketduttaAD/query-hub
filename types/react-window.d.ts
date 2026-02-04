declare module 'react-window' {
  import type { Component, CSSProperties, ReactNode, Ref, ElementType } from 'react';

  export interface ListChildComponentProps {
    index: number;
    style: CSSProperties;
    data: unknown;
    isScrolling?: boolean;
  }

  export interface FixedSizeListProps {
    children: (props: ListChildComponentProps) => ReactNode;
    className?: string;
    height: number | string;
    initialScrollOffset?: number;
    innerRef?: Ref<HTMLDivElement>;
    innerElementType?: ElementType;
    itemCount: number;
    itemData?: unknown;
    itemKey?: (index: number, data: unknown) => unknown;
    itemSize: number;
    onItemsRendered?: (props: {
      overscanStartIndex: number;
      overscanStopIndex: number;
      visibleStartIndex: number;
      visibleStopIndex: number;
    }) => void;
    onScroll?: (props: {
      scrollDirection: 'forward' | 'backward';
      scrollOffset: number;
      scrollUpdateWasRequested: boolean;
    }) => void;
    outerRef?: Ref<HTMLDivElement>;
    outerElementType?: ElementType;
    overscanCount?: number;
    style?: CSSProperties;
    useIsScrolling?: boolean;
    width: number | string;
  }

  export class FixedSizeList extends Component<FixedSizeListProps> {}
}
