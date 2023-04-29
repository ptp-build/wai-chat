import html2canvas from "html2canvas";
// import jsPDF from 'jspdf';
// import {dataUriToBlob} from "../../../util/files";

export async function generateImageFromDiv(ids: string[], gapHeight: number,backgroundColor:string,watermark:string = undefined,type:'image'|'pdf' = 'image'): Promise<string> {
  const divs = ids.map((id) => document.getElementById(id));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  let totalHeight = divs.reduce((sum, div) => sum + div.offsetHeight, 0) + gapHeight * (divs.length + 1);
  let waterHeight = 0
  if(watermark){
    waterHeight = 30
    totalHeight += waterHeight; // 加上水印的高度
  }

  canvas.width = Math.max(...divs.map((div) => div.offsetWidth));
  canvas.height = totalHeight;
  ctx.fillStyle = backgroundColor;

  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if(watermark){
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = "center";
    ctx.fillText(watermark, canvas.width / 2, 20); // 在顶部居中绘制水印
  }

  ctx.translate(0, gapHeight + waterHeight);
  for (let i = 0; i < divs.length; i++) {
    const div = divs[i];
    const bg = div.style.backgroundColor;
    div.style.backgroundColor = backgroundColor;
    const data = await html2canvas(div, {scale: window.devicePixelRatio});
    div.style.backgroundColor = bg;
    ctx.drawImage(data, 0, 0, div.offsetWidth, div.offsetHeight);
    ctx.translate(0, div.offsetHeight + gapHeight);
  }

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
  return URL.createObjectURL(blob);
}

export function canvasToPDF(canvas, pageWidth, pageHeight) {
  // const pdfHeight = 842;
  // const pageCount = Math.ceil(canvas.height / pdfHeight);
  // const pdf = new jsPDF("p", "pt", "a4");
  // const imgHeight = pdf.internal.pageSize.height;
  // const imgWidth = pdf.internal.pageSize.width;
  //
  // for (let i = 0; i < pageCount; i++) {
  //   if (i !== 0) {
  //     pdf.addPage();
  //   }
  //
  //   // 计算需要裁剪的区域
  //   const imgTop = -i * imgHeight;
  //   const imgLeft = 0;
  //   const srcWidth = canvas.width;
  //   const srcHeight = pdfHeight;
  //   const destWidth = imgWidth;
  //   const destHeight = imgHeight;
  //
  //   // 裁剪图像以适应PDF页的高度
  //   const canvasCopy = document.createElement("canvas");
  //   canvasCopy.width = srcWidth;
  //   canvasCopy.height = srcHeight;
  //   const ctxCopy = canvasCopy.getContext("2d");
  //   ctxCopy.drawImage(canvas, imgLeft, imgTop, srcWidth, srcHeight, 0, 0, destWidth, destHeight);
  //
  //   // 添加裁剪后的图像到PDF
  //   const imgDataCopy = canvasCopy.toDataURL("image/png");
  //   pdf.addImage(imgDataCopy, "PNG", 0, 0, destWidth, destHeight);
  // }
  // pdf.save("tes.pdf")
  // const dateUri = pdf.output("datauristring");
  // return dateUri
}

export function textToPDF(text, fileName) {
  // const lines = text.split('\n');
  // const doc = new jsPDF();
  // let cursorY = 10;
  //
  // lines.forEach(line => {
  //   const textLines = doc.splitTextToSize(line, doc.internal.pageSize.width - 20);
  //   doc.text(textLines,10, cursorY);
  //   cursorY += (textLines.length + 1) * 10; // add extra line height
  //   if (cursorY >= doc.internal.pageSize.height - 10) {
  //     doc.addPage();
  //     cursorY = 10;
  //   }
  // });
  //
  // doc.save(fileName);
}
