export interface HuggingFaceModelOption {
  id: string;
  name: string;
  description: string;
}

export const HUGGINGFACE_MODELS: HuggingFaceModelOption[] = [
  {
    id: "meta-llama/Llama-3.3-70B-Instruct",
    name: "Llama 3.3 70B",
    description: "Strong general writing & formal documents",
  },
  {
    id: "Qwen/Qwen2.5-72B-Instruct",
    name: "Qwen 2.5 72B",
    description: "Excellent at structured output (minutes, letters)",
  },
  {
    id: "meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B (Fast)",
    description: "Faster & uses less free quota",
  },
  {
    id: "google/gemma-2-27b-it",
    name: "Gemma 2 27B",
    description: "Solid open model from Google",
  },
  {
    id: "mistralai/Mistral-Small-24B-Instruct-2501",
    name: "Mistral Small 24B",
    description: "Good balance of quality and speed",
  },
  {
    id: "deepseek-ai/DeepSeek-R1",
    name: "DeepSeek R1",
    description: "Frontier reasoning & deep analytical synthesis",
  },
];

export const DEFAULT_HF_MODEL = "meta-llama/Llama-3.3-70B-Instruct";
