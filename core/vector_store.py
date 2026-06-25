from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

CHROMA_DIR = "vector_db"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={'device': 'cpu'}
    )


def get_collection_name(meeting_id: str) -> str:
    return f"meeting_{meeting_id}"


def build_vector_store(transcript: str, meeting_id: str, topic_id: str = None, title: str = None) -> Chroma:
    print(f"Building vector store for meeting_id={meeting_id}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(transcript)

    docs = [
        Document(
            page_content=chunk,
            metadata={
                'chunk_index': i,
                'meeting_id': meeting_id,
                'topic_id': topic_id or "",
                'title': title or "",
            }
        )
        for i, chunk in enumerate(chunks)
    ]

    embeddings = get_embeddings()
    vector_store = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=get_collection_name(meeting_id),
        persist_directory=CHROMA_DIR
    )
    return vector_store


def load_vector_store(meeting_id: str) -> Chroma:
    embeddings = get_embeddings()
    return Chroma(
        collection_name=get_collection_name(meeting_id),
        embedding_function=embeddings,
        persist_directory=CHROMA_DIR
    )


def get_retriever(vector_store: Chroma, k: int = 4):
    return vector_store.as_retriever(search_type='similarity', search_kwargs={"k": k})