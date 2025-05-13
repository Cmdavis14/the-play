// scripts/utils/component-loader.js
function loadComponent(targetElementId, componentPath) {
  console.log(`Attempting to load component from ${componentPath} into #${targetElementId}`);
  
  return fetch(componentPath)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load component from ${componentPath}: ${response.status} ${response.statusText}`);
      }
      return response.text();
    })
    .then(html => {
      const element = document.getElementById(targetElementId);
      if (element) {
        console.log(`Target element #${targetElementId} found, inserting HTML`);
        element.innerHTML = html;
        
        // Execute any scripts in the loaded component
        const scriptTags = element.querySelectorAll('script');
        console.log(`Found ${scriptTags.length} script tags in the component`);
        
        scriptTags.forEach((scriptTag, index) => {
          console.log(`Processing script ${index + 1}`);
          
          // Create a new script element
          const newScript = document.createElement('script');
          
          // Copy all attributes from the original script tag
          Array.from(scriptTag.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
          });
          
          // If it has src, just set the src attribute
          if (scriptTag.src) {
            console.log(`Script ${index + 1} has src: ${scriptTag.src}`);
            newScript.src = scriptTag.src;
          } else {
            // Otherwise, copy the script content
            console.log(`Script ${index + 1} is inline, copying content`);
            newScript.textContent = scriptTag.textContent;
          }
          
          // Add a load event for external scripts
          if (scriptTag.src) {
            newScript.onload = () => console.log(`External script ${index + 1} loaded`);
            newScript.onerror = (err) => console.error(`Error loading external script ${index + 1}:`, err);
          }
          
          // Replace the original script tag with the new one
          console.log(`Replacing original script ${index + 1} with new script element`);
          scriptTag.parentNode.replaceChild(newScript, scriptTag);
        });
        
        // Add a direct timeout execution for all inline scripts to ensure they run
        setTimeout(() => {
          const inlineScripts = element.querySelectorAll('script:not([src])');
          inlineScripts.forEach((script, index) => {
            try {
              console.log(`Evaluating inline script ${index + 1} content directly`);
              eval(script.textContent);
            } catch (error) {
              console.error(`Error evaluating inline script ${index + 1}:`, error);
            }
          });
        }, 100);
        
        console.log(`Component ${componentPath} loaded successfully into #${targetElementId}`);
        return true;
      } else {
        console.error(`Element with ID ${targetElementId} not found`);
        return false;
      }
    })
    .catch(error => {
      console.error('Error loading component:', error);
      return false;
    });
}

// Export the function
export { loadComponent };