import {h, render, Diagram, Node, Edge} from 'jsx-tikzcd'
import * as helper from './helper'

export function toJSON(diagram) {
    let leftTop = [0, 1].map(i => diagram.nodes.reduce(
        (min, node) => Math.min(min, node.position[i]),
        Infinity
    ))

    return JSON.stringify({
        nodes: diagram.nodes.map(node => ({
            ...node,
            id: undefined,
            position: node.position.map((x, i) => x - leftTop[i])
        })),

        edges: diagram.edges.map(edge => ({
            ...edge,
            from: diagram.nodes.findIndex(node => node.id === edge.from),
            to: diagram.nodes.findIndex(node => node.id === edge.to)
        }))
    })
}

export function fromJSON(json) {
    let obj = JSON.parse(json)
	console.log(obj)
    let nodes = obj.nodes.map(node => ({
        ...node,
        id: helper.getId()
    }))

    return {
        nodes,
        edges: obj.edges.map(edge => ({
            ...edge,
            from: nodes[edge.from].id,
            to: nodes[edge.to].id
        }))
    }
}

export function toBase64(diagram) {
    return btoa(toJSON(diagram))
}

export function fromBase64(base64) {
    return fromJSON(atob(base64))
}

export function toTeX(diagram) {
    return render(
        <Diagram>
            {diagram.nodes.map((node, i) =>
                <Node
                    key={node.id}
                    position={node.position}
                    value={node.value}
                />
            )}

            {diagram.edges.map(edge => [
                <Edge
                    from={edge.from}
                    to={edge.to}
                    value={edge.value}
                    labelPosition={edge.labelPosition}
                    args={[
                        ...[edge.head, edge.line, edge.tail].map((id, i) => ({
                            none: ['no head', null, null][i],
                            default: null,
                            harpoon: 'harpoon',
                            harpoonalt: "harpoon'",
                            hook: 'hook',
                            hookalt: "hook'",
                            mapsto: 'maps to',
                            tail: 'tail',
                            twoheads: 'two heads',
                            dashed: 'dashed',
                            dotted: 'dotted',
                            solid: null
                        })[id]),

                        edge.bend > 0 ? `bend left=${edge.bend}`.replace('=30', '')
                        : edge.bend < 0 ? `bend right=${-edge.bend}`.replace('=30', '')
                        : null
                    ].filter(x => x != null)}
                />
            ])}
        </Diagram>
    )
}

export function fromCode(code) {
	let nodes = [];
	let edges = [];
	let consumers = [
		{"string": "\\begin{tikzcd}"},
		{"string": "\\end{tikzcd}"},
		{"string": "&", "callback": function() {
			x++;
			console.log("new column", x);
		}},
		{"string": "\\\\", "callback": function() {
			y++;
			x = 0;
			console.log("new row", y);
		}},
		{"string": "\\arrow[", "callback": function() {
			let parts = code.split("]");
			let definition = parts.shift();
			code = parts.join("]");
			
			parts = definition.split(",");
			let dir = parts[0];
			
			let to_x = x + dir.split("r").length - 1 - (dir.split("l").length - 1);
			let to_y = y + dir.split("d").length - 1 - (dir.split("u").length - 1);

			let from = [x, y];
			let to = [to_x, to_y];

			let edge = {
				"from": from,
				"to": to
			};

			// value
			if(parts.length > 1 && parts[1].includes('"')) {
				edge.value = parts[1].split('"')[1].split('"')[0];
				if(parts[1].endsWith("'")) {
					edge.labelPosition = "right";
				}
				if(parts[1].endsWith("description")) {
					edge.labelPosition = "inside";
				}
			}

			// head
			if(definition.includes("harpoon")) {
				edge.head = "harpoon";	
			}
			if(definition.includes("harpoon'")) {
				edge.head = "harpoonalt";	
			}
			if(definition.includes("two heads")) {
				edge.head = "twoheads";	
			}
			if(definition.includes("no head")) {
				edge.head = "none";	
			}
			
			
			// tail
			if(definition.includes("hook")) {
				edge.tail = "hook";	
			}
			if(definition.includes("hook'")) {
				edge.tail = "hookalt";	
			}
			if(definition.includes("maps to")) {
				edge.tail = "mapsto";	
			}
			
			// line
			if(definition.includes("dashed")) {
				edge.line = "dashed";	
			}
			if(definition.includes("dotted")) {
				edge.line = "dotted";	
			}

			// bend
			if(definition.includes("bend left")) {
				let value = definition.match(/bend left=(\d+)/);
				if(value && value.length > 1) {
					edge.bend = parseInt(value[1]);
				}
				else {
					edge.bend = 30;
				}
			}
			if(definition.includes("bend right")) {
				let value = definition.match(/bend right=(\d+)/);
				if(value && value.length > 1) {
					edge.bend = -parseInt(value[1]);
				}
				else {
					edge.bend = -30;
				}
			}

			console.log("new edge", edge);
			edges.push(edge);
		}},
		{"string": "", "callback": function() {
			let splitIndex = Math.min.apply(null, [code.indexOf("&"), code.indexOf("\n"), code.indexOf("\\\\"), code.indexOf("\\arrow")].filter(val => val > -1));
			if(splitIndex === -1) {
				throw "Cannot find node value delimiter";
			}
			let value = code.substr(0, splitIndex);
			value = value.trim();
			code = code.substr(splitIndex);

			if(value.length === 0) {
				throw "Empty node found";
			}
			
			let node = {
				"position": [x, y],
				"value": value
			};
			console.log("new node", node);
			nodes.push(node);
		}}
	];
	let x = 0;
	let y = 0;
	while(code.length !== 0) {
		code = code.trim();
		let consumed = false;
		for(let consumer of consumers) {
			if(code.startsWith(consumer.string)) {
				code = code.replace(consumer.string, "");
				if(consumer.callback) {
					consumer.callback();
				}
				consumed = true;
				console.log("consumed " + consumer.string + ", remaining code is:", code);
				break;
			}
		}
		if(!consumed) {
			console.log(code);
			throw "Error during consuming";
		}
	}
	
	function positionToIndex(edge) {
		let from = edge.from;
		let to = edge.to;
		
		let fromIndex = -1;
		let toIndex = -1;
		for(let i=0;i<nodes.length;i++) {
			if(nodes[i].position[0] === from[0] && nodes[i].position[1] === from[1]) {
				fromIndex = i;
			}
			if(nodes[i].position[0] === to[0] && nodes[i].position[1] === to[1]) {
				toIndex = i;
			}
		}
		if(fromIndex === -1 || toIndex === -1) {
			throw "Could not find node index for egde";
		}
		edge.from = fromIndex;
		edge.to = toIndex;
	}
	
	console.log(nodes);
	console.log(edges);

	for(let edge of edges) {
		positionToIndex(edge);
	}

	console.log(JSON.stringify({"nodes": nodes, "edges": edges}));
	
	return fromJSON(JSON.stringify({"nodes": nodes, "edges": edges}));
}
