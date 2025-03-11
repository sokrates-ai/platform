export interface DraggableStateData {
    x: number;
    y: number;
    label: string;
    id: number;
    textureSources: string[];
    associatedWithChapterID: number | null;
  }
  
  export interface DraggableState {
    node: React.ReactNode;
    data: DraggableStateData;
  }
  