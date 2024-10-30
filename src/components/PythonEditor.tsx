import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import Editor from "@monaco-editor/react";
import { loadPyodide, type PyodideInterface } from "pyodide";

const defaultCode = `import numpy as np
import matplotlib.pyplot as plt

# データの生成
x = np.linspace(0, 10, 100)
y1 = np.sin(x)
y2 = np.cos(x)

# プロットの作成
plt.figure(figsize=(10, 6))
plt.plot(x, y1, label='sin(x)')
plt.plot(x, y2, label='cos(x)')
plt.title('Sine and Cosine Waves')
plt.xlabel('x')
plt.ylabel('y')
plt.grid(True)
plt.legend()
plt.show()`;

export function PythonEditor() {
  const [output, setOutput] = useState("");
  const [plots, setPlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [currentCode, setCurrentCode] = useState(defaultCode);

  useEffect(() => {
    const initPyodide = async () => {
      try {
        setStatus("Loading Python environment...");
        const pyodide = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
        });

        setStatus("Loading NumPy and Matplotlib...");
        await pyodide.loadPackage(["numpy", "matplotlib"]);

        setStatus("Configuring plotting...");
        await pyodide.runPythonAsync(`
          import matplotlib.pyplot as plt
          plt.switch_backend('agg')
        `);

        setPyodide(pyodide);
        setIsLoading(false);
        setStatus("Ready!");
      } catch (err) {
        setStatus(`Error: ${(err as Error).message}`);
        console.error("Pyodide initialization failed:", err);
      }
    };

    initPyodide();
  }, []);

  const runPython = async () => {
    if (!pyodide) return;

    setIsRunning(true);
    setOutput("Running...");
    setPlots([]);

    try {
      await pyodide.runPythonAsync(`
        import sys
        from io import StringIO
        sys.stdout = StringIO()
      `);

      await pyodide.runPythonAsync(currentCode);

      const stdout = await pyodide.runPythonAsync("sys.stdout.getvalue()");
      setOutput(stdout || "Execution completed");

      const figures = await pyodide.runPythonAsync(`
        import base64
        from io import BytesIO

        plot_data = []
        for i in plt.get_fignums():
            fig = plt.figure(i)
            buf = BytesIO()
            fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            plot_data.append(base64.b64encode(buf.getvalue()).decode('utf-8'))
            plt.close(fig)
        plot_data
      `);

      setPlots(figures);
    } catch (err) {
      setOutput(`Error: ${(err as Error).message}`);
      console.error("Execution error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setCurrentCode(value);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gray-800 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Python Web Editor
            </h1>
            <div className="flex items-center space-x-2">
              {isLoading
                ? (
                  <span className="text-gray-300 text-sm flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {status}
                  </span>
                )
                : (
                  <button
                    onClick={runPython}
                    disabled={isRunning}
                    className="flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRunning
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Play className="w-4 h-4 mr-2" />}
                    {isRunning ? "Running..." : "Run"}
                  </button>
                )}
            </div>
          </div>

          {/* Editor */}
          <div className="border-b border-gray-200">
            <Editor
              height="400px"
              defaultLanguage="python"
              defaultValue={defaultCode}
              theme="vs-dark"
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                tabSize: 4,
                insertSpaces: true,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Output Area */}
          <div className="p-6 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Output</h2>
            {output && (
              <pre className="bg-white p-4 rounded-md border border-gray-200 overflow-x-auto text-sm text-gray-800">
                {output}
              </pre>
            )}

            {/* Plot Display Area */}
            {plots.length > 0 && (
              <div className="mt-6 space-y-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Plots
                </h2>
                <div className="grid gap-4">
                  {plots.map((plot, index) => (
                    <div
                      key={index}
                      className="bg-white p-4 rounded-md border border-gray-200"
                    >
                      <img
                        src={`data:image/png;base64,${plot}`}
                        alt={`Plot ${index + 1}`}
                        className="max-w-full h-auto mx-auto"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Press Ctrl+Enter to run the code</p>
        </div>
      </div>
    </div>
  );
}
