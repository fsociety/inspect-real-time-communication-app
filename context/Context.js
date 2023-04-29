import Script from 'next/script';
import React,{createContext, useState} from 'react'


export const ContextProvider = createContext({
  sfuVideoRoom: null
});

export default function Context({ children }) {
    const [contextData, setContextData] = useState({});
    return (
      <ContextProvider.Provider value={{ contextData, setContextData }}>
          {children}
      </ContextProvider.Provider>
    )
}
