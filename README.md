# MuralDB

MuralDB is a lightweight abstraction over the NeDB database system that is specifically designed to filter, search, sort, and modify the elements(widgets) exposed by the Mural.co API.

### Purpose
Mural.co is an online whiteboarding website.  It has, like many whiteboarding tools, the capability to create sticky notes, images, text boxes, etc.  It can also connect these boxes through arrows.  

Regretably, the standard export function the Mural.co interface does not include important contextual information like arrows from or to a box or colors of the box, all of which are important elements of a visual medium like Mural.

This library was designed to enable complex usage of the Mural.co whiteboard while also supporting fast-scripting based on the API outputs that includes colors, text filters, and relationships drawn with arrows.

You can create complex graph or set of graphs in Mural.co and with this library, quickly transform that visual information into a useful output.

