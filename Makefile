.PHONY: all clean

all: dist/index.html dist/bundle.min.js dist/styles.min.css

dist:
	mkdir -p dist

dist/bundle.min.js: index.js | dist
	npx esbuild index.js \
		--bundle \
		--minify \
		--outfile=dist/bundle.min.js

dist/styles.min.css: styles.css | dist
	npx esbuild styles.css --minify --outfile=dist/styles.min.css

dist/index.html: index.html | dist
	cp index.html dist
	
	sed -i 's/src="index\.js"/src="bundle.min.js"/g' dist/index.html
	echo "Replaced index.js -> bundle.min.js"

	sed -i 's/href="styles\.css"/href="styles.min.css"/g' dist/index.html
	echo "Replaced styles.css -> styles.min.css"

clean:
	rm -rf dist
