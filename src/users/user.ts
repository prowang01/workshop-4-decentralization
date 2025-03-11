import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { createRandomSymmetricKey, exportSymKey, rsaEncrypt, symEncrypt } from "../crypto";
import axios from "axios";

export function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  const port = BASE_USER_PORT + userId;

  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;
  let lastCircuit: number[] | null = null;

  _user.get("/status", (req: Request, res: Response) => {
    return res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req: Request, res: Response) => {
    return res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req: Request, res: Response) => {
    return res.json({ result: lastSentMessage });
  });

  _user.post("/message", (req: Request, res: Response) => {
    const message = req.body.message;
    if (!message) {
      return res.status(400).json({ error: "Message requis" });
    }
    lastReceivedMessage = message;
    return res.send("success");
  });

  _user.get("/getLastCircuit", (req: Request, res: Response) => {
    return res.json({ result: lastCircuit });
  });

  _user.post("/sendMessage", async (req: Request, res: Response) => {
    try {
      const { message, destinationUserId } = req.body;
      if (!message || destinationUserId === undefined) {
        return res.status(400).json({ error: "Paramètres manquants" });
      }

      const { data } = await axios.get<{ nodes: { nodeId: number; pubKey: string }[] }>(
        `http://localhost:${REGISTRY_PORT}/getNodeRegistry`
      );
      
      if (data.nodes.length < 3) {
        return res.status(400).json({ error: "Pas assez de nœuds" });
      }

      // Mélange Fisher-Yates amélioré
      const shuffledNodes = [...data.nodes];
      for (let i = shuffledNodes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledNodes[i], shuffledNodes[j]] = [shuffledNodes[j], shuffledNodes[i]];
      }
      
      const circuit = shuffledNodes.slice(0, 3).reverse();
      lastCircuit = circuit.map(n => n.nodeId);

      let finalMessage = message;

      for (let i = circuit.length - 1; i >= 0; i--) {
        const node = circuit[i];
        const symKey = await createRandomSymmetricKey();
        const symKeyBase64 = await exportSymKey(symKey);
        
        const nextDestination = i === 0 
          ? BASE_USER_PORT + destinationUserId 
          : BASE_ONION_ROUTER_PORT + circuit[i - 1].nodeId;

        // Padding strict sur 10 caractères
        const destinationStr = nextDestination.toString().padStart(10, "0");
        const encryptedMessage = await symEncrypt(symKey, destinationStr + finalMessage);
        const encryptedSymKey = await rsaEncrypt(symKeyBase64, node.pubKey);

        finalMessage = encryptedSymKey + encryptedMessage;
      }

      await axios.post(
        `http://localhost:${BASE_ONION_ROUTER_PORT + circuit[0].nodeId}/message`,
        { message: finalMessage }
      );

      lastSentMessage = message;
      return res.json({ success: true });

    } catch (err) {
      console.error("Erreur détaillée:", err);
      return res.status(500).json({ error: "Échec de l'envoi" });
    }
  });

  return _user.listen(port, () => {
    console.log(`User ${userId} listening on port ${port}`);
  });
}