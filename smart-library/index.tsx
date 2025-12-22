import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Book, 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Clock, 
  MoreVertical, 
  Plus, 
  Search, 
  Sparkles, 
  Star, 
  Trash2,
  Library,
  FileText,
  PenTool
} from "lucide-react";

// --- Types ---

type ReadingStatus = "want-to-read" | "reading" | "finished";

interface BookItem {
  id: string;
  title: string;
  author: string;
  status: ReadingStatus;
  rating: number; // 0 to 5
  summary: string;
  genre: string;
  coverColor: string;
  addedAt: number;
}

// --- Constants & Initial Data ---

const MOCK_BOOKS: BookItem[] = [
  {
    id: "1",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    status: "finished",
    rating: 4,
    summary: "A mysterious millionaire's obsession with a former lover leads to tragedy in the Jazz Age.",
    genre: "Classic",
    coverColor: "#E2C2B3",
    addedAt: Date.now(),
  }
];

// --- Gemini Client ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Components ---

const StarRating = ({ rating, onRate, readOnly = false }: { rating: number, onRate?: (r: number) => void, readOnly?: boolean }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          disabled={readOnly}
          onClick={(e) => {
            e.stopPropagation();
            onRate?.(star);
          }}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          <Star
            size={16}
            className={`${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

const App = () => {
  const [books, setBooks] = useState<BookItem[]>(() => {
    const saved = localStorage.getItem("smart-library-books");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse books from local storage", e);
      }
    }
    return MOCK_BOOKS;
  });

  useEffect(() => {
    localStorage.setItem("smart-library-books", JSON.stringify(books));
  }, [books]);
  const [filter, setFilter] = useState<ReadingStatus | "all">("all");
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "import">("single");
  
  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [importText, setImportText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Actions ---

  const handleDelete = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  const handleUpdateStatus = (id: string, status: ReadingStatus) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  const handleRate = (id: string, rating: number) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, rating } : b));
  };

  const generateBookDetails = async (title: string, author: string) => {
    if (!title) return null;
    setIsGenerating(true);
    try {
      const prompt = `Analyze the book "${title}"${author ? ` by ${author}` : ""}. 
      Return a JSON object with:
      1. A 1-sentence engaging summary.
      2. A short genre (e.g., "Sci-Fi", "History").
      3. A soft pastel hex color code (e.g., #F3E5F5) that matches the book's mood.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              genre: { type: Type.STRING },
              hexColor: { type: Type.STRING },
            },
            required: ["summary", "genre", "hexColor"],
          },
        },
      });

      const data = JSON.parse(response.text);
      return data;
    } catch (error) {
      console.error("AI Generation failed", error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsGenerating(true);

    try {
      const prompt = `Identify and extract all books mentioned in the following text. 
      Text content:
      """
      ${importText}
      """
      
      For each book found:
      1. Extract the title and author (clean up any numbering like "1." or punctuation).
      2. Generate a 1-sentence engaging summary in the same language as the book title (default to Chinese if uncertain).
      3. Determine the genre.
      4. Pick a unique soft pastel hex color code.
      
      Return a JSON array of objects.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                summary: { type: Type.STRING },
                genre: { type: Type.STRING },
                hexColor: { type: Type.STRING },
              },
              required: ["title", "author", "summary", "genre", "hexColor"],
            },
          },
        },
      });

      const data = JSON.parse(response.text);
      
      if (Array.isArray(data)) {
        const newBooks: BookItem[] = data.map((b: any, index: number) => ({
          id: Date.now().toString() + "-" + index,
          title: b.title,
          author: b.author || "Unknown Author",
          status: "want-to-read",
          rating: 0,
          summary: b.summary,
          genre: b.genre,
          coverColor: b.hexColor,
          addedAt: Date.now()
        }));
        
        setBooks(prev => [...newBooks, ...prev]);
        setImportText("");
        setIsAdding(false);
      }
    } catch (error) {
      console.error("Bulk import failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddBook = async (useAI: boolean) => {
    if (!newTitle.trim()) return;

    let details = {
      summary: "No summary added.",
      genre: "General",
      hexColor: "#E5E7EB" // Default gray
    };

    if (useAI) {
      const aiData = await generateBookDetails(newTitle, newAuthor);
      if (aiData) {
        details = {
          summary: aiData.summary,
          genre: aiData.genre,
          hexColor: aiData.hexColor
        };
      }
    }

    const newBook: BookItem = {
      id: Date.now().toString(),
      title: newTitle,
      author: newAuthor || "Unknown Author",
      status: "want-to-read",
      rating: 0,
      summary: details.summary,
      genre: details.genre,
      coverColor: details.hexColor,
      addedAt: Date.now()
    };

    setBooks(prev => [newBook, ...prev]);
    setNewTitle("");
    setNewAuthor("");
    setIsAdding(false);
  };

  // --- Filtering ---

  const filteredBooks = books.filter(b => filter === "all" ? true : b.status === filter);
  const stats = {
    total: books.length,
    reading: books.filter(b => b.status === "reading").length,
    finished: books.filter(b => b.status === "finished").length,
  };

  // --- UI Helpers ---

  const getStatusIcon = (status: ReadingStatus) => {
    switch(status) {
      case "finished": return <CheckCircle2 size={16} className="text-green-600" />;
      case "reading": return <BookOpen size={16} className="text-amber-600" />;
      case "want-to-read": return <Clock size={16} className="text-slate-500" />;
    }
  };

  const getStatusLabel = (status: ReadingStatus) => {
    switch(status) {
      case "finished": return "Finished";
      case "reading": return "Reading";
      case "want-to-read": return "To Read";
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fdfbf7]/90 backdrop-blur-md border-b border-stone-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-800 rounded-lg flex items-center justify-center text-white">
              <Library size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 serif tracking-tight">Book Nook</h1>
              <p className="text-xs text-stone-500 font-medium tracking-wide uppercase">
                {stats.total} Books • {stats.reading} Active • {stats.finished} Read
              </p>
            </div>
          </div>

          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-full hover:bg-stone-700 transition-colors shadow-sm text-sm font-medium"
          >
            {isAdding ? <CheckCircle2 size={16} /> : <Plus size={16} />}
            {isAdding ? "Close Form" : "Add Book"}
          </button>
        </div>
      </header>

      {/* Add Book Form */}
      {isAdding && (
        <div className="max-w-5xl mx-auto px-6 mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden">
            
            {/* Tabs */}
            <div className="flex border-b border-stone-100">
              <button 
                onClick={() => setAddMode("single")}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  addMode === "single" 
                    ? "bg-white text-stone-900 border-b-2 border-stone-900" 
                    : "bg-stone-50 text-stone-500 hover:bg-stone-100"
                }`}
              >
                <PenTool size={14} /> Single Book
              </button>
              <button 
                onClick={() => setAddMode("import")}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  addMode === "import" 
                    ? "bg-white text-stone-900 border-b-2 border-stone-900" 
                    : "bg-stone-50 text-stone-500 hover:bg-stone-100"
                }`}
              >
                <FileText size={14} /> Smart Import
              </button>
            </div>

            <div className="p-6">
              {addMode === "single" ? (
                <>
                  <h2 className="text-lg font-semibold text-stone-800 mb-4">Add a Single Book</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Title</label>
                      <input 
                        type="text" 
                        placeholder="e.g. The Hobbit"
                        className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-stone-200 outline-none transition-all"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Author</label>
                      <input 
                        type="text" 
                        placeholder="e.g. J.R.R. Tolkien"
                        className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-stone-200 outline-none transition-all"
                        value={newAuthor}
                        onChange={e => setNewAuthor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAddBook(true)}
                      disabled={isGenerating || !newTitle}
                      className="flex-1 py-3 rounded-xl bg-purple-100 text-purple-900 font-medium hover:bg-purple-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <div className="w-5 h-5 border-2 border-purple-900 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles size={18} />
                      )}
                      Magic Add
                    </button>
                    <button 
                      onClick={() => handleAddBook(false)}
                      disabled={!newTitle || isGenerating}
                      className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-600 font-medium hover:bg-stone-200 transition-colors disabled:opacity-50"
                    >
                      Manual Add
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-stone-800">Paste Book List</h2>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-medium">AI Powered</span>
                  </div>
                  <p className="text-sm text-stone-500 mb-3">
                    Paste any text containing book titles (blogs, chats, articles). The AI will find and list them for you.
                  </p>
                  <textarea
                    className="w-full h-32 px-4 py-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-stone-200 outline-none transition-all resize-none text-sm mb-4"
                    placeholder="Paste text here... (e.g. 'Here are 5 books I recommend: 1. The Alchemist...')"
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                  />
                  <button 
                    onClick={handleBulkImport}
                    disabled={isGenerating || !importText.trim()}
                    className="w-full py-3 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing Books...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Analyze & Import Books
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-5xl mx-auto px-6 mt-8 mb-6">
        <div className="flex flex-wrap gap-2">
          {(["all", "want-to-read", "reading", "finished"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                filter === status 
                  ? "bg-white border-stone-300 text-stone-900 shadow-sm" 
                  : "bg-transparent border-transparent text-stone-500 hover:bg-white/50"
              }`}
            >
              {status === "all" ? "All Books" : getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Book Grid */}
      <main className="max-w-5xl mx-auto px-6 pb-20">
        {filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <Book size={48} strokeWidth={1} className="mb-4" />
            <p className="text-lg font-medium">Your shelves are empty.</p>
            <p className="text-sm">Add a book to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map((book) => (
              <div 
                key={book.id}
                className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-stone-100 flex flex-col animate-in fade-in duration-500"
              >
                {/* Card Header / Spine Color */}
                <div 
                  className="h-24 w-full relative p-4 flex items-start justify-between"
                  style={{ backgroundColor: book.coverColor }}
                >
                  <span className="px-2 py-1 bg-white/30 backdrop-blur-md rounded-md text-[10px] font-bold uppercase tracking-wider text-stone-900/70">
                    {book.genre}
                  </span>
                  <button 
                    onClick={() => handleDelete(book.id)}
                    className="p-1.5 bg-white/30 backdrop-blur-md rounded-full text-stone-900/70 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    title="Delete book"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-1 flex justify-between items-start gap-2">
                    <h3 className="text-lg font-bold text-stone-900 serif leading-tight line-clamp-2">
                      {book.title}
                    </h3>
                  </div>
                  <p className="text-sm text-stone-500 font-medium mb-3">{book.author}</p>
                  
                  <p className="text-sm text-stone-600 leading-relaxed line-clamp-3 mb-4 flex-1">
                    {book.summary}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-stone-100 mt-auto">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(book.status)}
                      <select 
                        value={book.status}
                        onChange={(e) => handleUpdateStatus(book.id, e.target.value as ReadingStatus)}
                        className="text-xs font-semibold uppercase tracking-wide text-stone-600 bg-transparent outline-none cursor-pointer hover:text-stone-900"
                      >
                        <option value="want-to-read">To Read</option>
                        <option value="reading">Reading</option>
                        <option value="finished">Finished</option>
                      </select>
                    </div>
                    
                    <StarRating 
                      rating={book.rating} 
                      onRate={(r) => handleRate(book.id, r)} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);