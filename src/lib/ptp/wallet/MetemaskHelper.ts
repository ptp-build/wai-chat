// const { Buffer } = require('buffer');
// var ethUtil = require('ethereumjs-util');
//
// export default class MetemaskHelper {
//   signByMetamask(
//     message: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>
//   ) {
//     // @ts-ignore
//     const { ethereum } = window;
//     return new Promise((resolve, reject) => {
//       ethereum.enable().then((r: any[]) => {
//         const fromAddress = r[0];
//         const msg = ethUtil.bufferToHex(Buffer.from(message));
//         const params = [msg, fromAddress];
//         const method = 'personal_sign';
//         // @ts-ignore
//         window.web3.currentProvider.sendAsync(
//           {
//             method,
//             params,
//             from: fromAddress,
//           },
//           function (err: any, result: { error: any; result: unknown }) {
//             if (err) return reject(err);
//             if (result.error) return reject(result.error);
//             resolve(result.result);
//           }
//         );
//       });
//     });
//   }
// }
export default {}
