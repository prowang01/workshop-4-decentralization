import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt, importSymKey, symDecrypt } from "../crypto"; // Ajout des imports manquants
import axios from "axios";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  const port = BASE_ONION_ROUTER_PORT + nodeId;

  // 📌 Génération des clés RSA
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const pubKeyPEM = await exportPubKey(publicKey);
  const privKeyPEM = await exportPrvKey(privateKey);

  // 📌 Enregistrement du nœud dans le registre
  await axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    nodeId,
    pubKey: pubKeyPEM,
  }).catch(err => console.error(`Erreur enregistrement nœud ${nodeId}:`, err));

  // 📌 Variables pour stocker les messages
  let lastEncryptedMessage: string | null = null;
  let lastDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  // ✅ Route pour vérifier si le nœud tourne
  onionRouter.get("/status", (req: Request, res: Response) => res.send("live"));

  // ✅ Récupérer le dernier message chiffré reçu
  onionRouter.get("/getLastReceivedEncryptedMessage", (req: Request, res: Response) => res.json({ result: lastEncryptedMessage }));

  // ✅ Récupérer le dernier message déchiffré
  onionRouter.get("/getLastReceivedDecryptedMessage", (req: Request, res: Response) => res.json({ result: lastDecryptedMessage }));

  // ✅ Récupérer la dernière destination du message
  onionRouter.get("/getLastMessageDestination", (req: Request, res: Response) => res.json({ result: lastMessageDestination }));

  // ✅ Récupérer la clé privée (pour les tests)
  onionRouter.get("/getPrivateKey", (req: Request, res: Response) => res.json({ result: privKeyPEM }));

  // ✅ Route pour recevoir un message et le transférer au bon destinataire
  onionRouter.post("/message", async (req: Request, res: Response) => {
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: "Message requis" });

    lastEncryptedMessage = message;

    try {
      const encryptedSymKeyLength = 344; // Longueur fixe pour la clé RSA chiffrée en base64
      const encryptedSymKey = message.slice(0, encryptedSymKeyLength);
      const encryptedMessageAES = message.slice(encryptedSymKeyLength);

      const symKeyBase64 = await rsaDecrypt(encryptedSymKey, privateKey);
      const symKey = await importSymKey(symKeyBase64); // Utilisation de importSymKey

      const decryptedMessageAES = await symDecrypt(symKeyBase64, encryptedMessageAES); // Utilisation de symDecrypt
      const nextDestinationStr = decryptedMessageAES.slice(0, 10);
      const innerMessage = decryptedMessageAES.slice(10);

      lastDecryptedMessage = innerMessage;
      lastMessageDestination = parseInt(nextDestinationStr, 10);

      await axios.post(`http://localhost:${lastMessageDestination}/message`, { message: innerMessage });
      return res.json({ message: "Message transféré avec succès" });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Échec du déchiffrement" });
    }
  });

  const server = onionRouter.listen(port, () => console.log(`🧅 Onion router ${nodeId} is listening on port ${port}`));

  return server;
}