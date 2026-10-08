import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
export default function PDFThumbnail({ url }: { url: string }) {
  return <Document file={url} loading={<span>PDF</span>} error={<span>PDF</span>}>
    <Page pageNumber={1} width={72} renderTextLayer={false} renderAnnotationLayer={false} loading={<span>PDF</span>} />
  </Document>;
}
