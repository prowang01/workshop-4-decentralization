import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };
export type RegisterNodeBody = { nodeId: number; pubKey: string };
export type GetNodeRegistryBody = { nodes: Node[] };

// 📌 Liste des nœuds enregistrés
const nodesRegistry: Node[] = [];

export function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // 📌 Route pour vérifier si le registre tourne
  _registry.get("/status", (req: Request, res: Response) => {
    res.send("live");
  });

  // 📌 Route pour enregistrer un nœud
  _registry.post("/registerNode", (req: Request, res: Response) => {
    console.log("📥 Requête reçue :", req.body);

    const { nodeId, pubKey } = req.body as RegisterNodeBody;

    if (nodeId === undefined || pubKey === undefined || pubKey.trim() === "") {
      return res.status(400).json({ error: "nodeId et pubKey sont requis" });
    }

    // Vérifier si le nœud est déjà enregistré
    const nodeExists = nodesRegistry.some((node) => node.nodeId === nodeId);
    if (nodeExists) {
      return res.status(400).json({ error: "Ce nœud est déjà enregistré" });
    }

    nodesRegistry.push({ nodeId, pubKey });

    console.log(`✅ Nœud ${nodeId} enregistré avec clé publique.`);
    console.log(`📡 Nombre total de nœuds : ${nodesRegistry.length}`);

    return res.json({ message: "Nœud enregistré avec succès" });
  });

  // 📌 Route pour récupérer la liste des nœuds enregistrés
  _registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    console.log(`📡 Récupération du registre : ${nodesRegistry.length} nœuds.`);
    return res.json({ nodes: nodesRegistry });
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`✅ Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
