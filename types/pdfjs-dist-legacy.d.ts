declare module 'pdfjs-dist/legacy/build/pdf' {
    // Minimal type declarations; expand as needed
    export const GlobalWorkerOptions: {
        workerSrc: string;
    };

    interface PDFDocumentProxy {
        numPages: number;
        getPage(pageNumber: number): Promise<any>;
    }

    interface GetDocumentOptions {
        data?: Uint8Array;
        disableWorker?: boolean;
    }

    export function getDocument(src: Uint8Array | GetDocumentOptions): {
        promise: Promise<PDFDocumentProxy>
    };
}
